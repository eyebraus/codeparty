
/* 
 * ----------------
 * scale.c
 * Sean Brennan <sbrennan@u.rochester.edu>
 * CSC 258, Feb. 18 2013
 * ================
 * implements spin locks and barriers discussed in the MC+S reading.
 * intended for i386 arches (e.g. the cycle machines)
 * ----------------
 */

#define _XOPEN_SOURCE 600

#include <assert.h>
#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string>
#include <unistd.h>

#include "atomic_ops.h"
#include "barriers.h"
#include "hrtimer/hrtimer_x86.h"
#include "scale.h"

#define TREE_FAN 4

unsigned long long the_count; // AH AH AH AH AH!
volatile unsigned long fai_count;
extern char *optarg;

// different mutex strategies
pthread_mutex_t mutex_pthread_lock;
tas_lock_t mutex_tas_lock;
ticket_lock_t mutex_ticket_lock;
mcs_qnode_t *mutex_mcs_lock;
pthread_mutex_t barrier_mutex;
pthread_cond_t barrier_cond;
volatile unsigned int *thread_sense;
tree_node_t *tree_barrier_nodes;
tree_node_t **tree_barrier_leaves;
int tree_barrier_node_amt;

int main(int argc, char *argv[]) {
    int i;
    int nthreads, nincrements, synch_mode, test_mode;
    double exec_time;

    // set defaults
    nthreads = DEF_THREADS;
    nincrements = DEF_INCREMENTS;
    synch_mode = NO_SYNC;
    test_mode = EVERY;

    // parse cmdline args
    while((i = getopt(argc, argv, "t:i:s:m:")) != -1){
        switch(i) {
            // # threads
            case 't':
                {
                    int t;
                    t = atoi(optarg);
                    if (t > 0){
                        nthreads = t;
                    } else {
                        fprintf(stderr, "Entered # threads is %d, which is invalid, silly. Using default %d instead.\n", t, (int) DEF_THREADS);
                    }
                }
                break;
            // # iterations
            case 'i':
                {
                    int in;
                    in = atoi(optarg);
                    if (in > 0) {
                        nincrements = in;
                    } else {
                        fprintf(stderr, "Entered # increments is %d, which is invalid, silly. Using default %d instead.\n", in, (int) DEF_INCREMENTS);
                    }
                }
                break;
            // synchronization strategy
            case 's':
                {
                    char *s;
                    s = optarg;
                    std::string sstr (s);
                    if(sstr.compare("no_sync") == 0) {
                        synch_mode = NO_SYNC;
                    } else if(sstr.compare("pthread_lock") == 0) {
                        synch_mode = PTHREAD_LOCK;
                    } else if(sstr.compare("tas") == 0) {
                        synch_mode = TAS;
                    } else if(sstr.compare("tatas") == 0) {
                        synch_mode = TATAS;
                    } else if(sstr.compare("tatas_backoff") == 0) {
                        synch_mode = TATAS_BACKOFF;
                    } else if(sstr.compare("ticket") == 0) {
                        synch_mode = TICKET;
                    } else if(sstr.compare("mcs") == 0) {
                        synch_mode = MCS;
                        // initialize the MCS lock
                        mutex_mcs_lock = (mcs_qnode_t *) malloc(sizeof(mcs_qnode_t));
                    } else if(sstr.compare("fai") == 0) {
                        synch_mode = FAI;
                    } else if(sstr.compare("pthread_bar") == 0) {
                        synch_mode = PTHREAD_BAR;
                        // initialize barrier variables
                        barrier_mutex = PTHREAD_MUTEX_INITIALIZER;
                        barrier_cond = PTHREAD_COND_INITIALIZER;
                    } else if(sstr.compare("sense_rev") == 0) {
                        synch_mode = SENSE_REV;
                    } else if(sstr.compare("tree_bar") == 0) {
                        synch_mode = TREE_BAR;
                    } else {
                        fprintf(stderr, "Mode \"%s\" is unknown dude, using default \"no_sync\" instead.\n", s);
                    }
                }
                break;
            // testing mode (TOTAL vs EVERY)
            case 'm':
                {
                    char* m;
                    m = optarg;
                    std::string mstr (m);
                    if(mstr.compare("total") == 0) {
                        test_mode = TOTAL;
                    } else if(mstr.compare("every") == 0) {
                        test_mode = EVERY;
                    } else {
                        fprintf(stderr, "Mode \"%s\" is unknown dude, using default \"every\" instead.\n", m);
                    }
                }
                break;
            default:
                assert(0);
                break;
        }
    }

    // execute the experiment and output results
    results_t *results = execute(nthreads, nincrements, synch_mode, test_mode);
    print_results(results, nthreads, synch_mode,test_mode);

    return 0;
}

void print_results(results_t *results, int thr, int sync, int test) {
    int i;
    unsigned long long running_total = 0;
    fprintf(stdout, "Experimental Results...\n");
    fprintf(stdout, "\tExecution time (s): %.9f\n", results->exec_time);
    // (don't output these results for barriers since they are meaningless)
    if(!(sync == PTHREAD_BAR || sync == SENSE_REV || sync == TREE_BAR)) {
        fprintf(stdout, "\tFinal count: %llu\n", results->final_count);
        // output individual thread increments for the total testing mode
        if(test == TOTAL) {
            for(i = 0; i < thr; i++) {
                fprintf(stdout, "\tThread #%d increment count: %llu\n", i, results->times_incremented[i]);
                running_total += (unsigned long long) results->times_incremented[i];
            }
            fprintf(stdout, "\tTotal increments: %llu\n", running_total);
        }
    }
    free(results->times_incremented);
    free(results);
}

results_t *execute(int thr, int inc, int sync, int test) {
    int i, barrier_stat;
    double start_time, end_time;
    results_t *results;
    pthread_t **threads;
    thread_args_t **args;
    pthread_barrier_t *start_barrier;
    void *(*sync_function)(void *);

    // create threads and args arrays
    threads = (pthread_t **) malloc(thr * sizeof(pthread_t *));
    args = (thread_args_t **) malloc(thr * sizeof(thread_args_t *));

    // create final results struct
    results = (results_t *) malloc(sizeof(results_t));
    results->times_incremented = (unsigned long long *) malloc(thr * sizeof(unsigned long long));

    // create barrier
    start_barrier = (pthread_barrier_t *) malloc(sizeof(pthread_barrier_t));
    if(pthread_barrier_init(start_barrier, NULL, thr + 1)) {
        fprintf(stderr, "Uh oh, I couldn't create a barrier for you :(\n");
        exit(-1);
    }

    // decide which sync procedure to use
    switch(sync) {
        case NO_SYNC:
            sync_function = &sync_no_sync;
            break;
        case PTHREAD_LOCK:
            sync_function = &sync_pthread_lock;
            break;
        case TAS:
            sync_function = &sync_tas;
            break;
        case TATAS:
            sync_function = &sync_tatas;
            break;
        case TATAS_BACKOFF:
            sync_function = &sync_tatas_backoff;
            break;
        case TICKET:
            sync_function = &sync_ticket;
            break;
        case MCS:
            sync_function = &sync_mcs;
            break;
        case FAI:
            sync_function = &sync_fai;
            break;
        case PTHREAD_BAR:
            sync_function = &sync_pthread_bar;
            break;
        case SENSE_REV:
            sync_function = &sync_sense_rev;
            break;
        case TREE_BAR:
            sync_function = &sync_tree_bar;
            break;
        default:
            fprintf(stderr, "What is this mode man? [%d], what? Come on.", sync);
            return NULL;
    }

    // initialize threads
    for(i = 0; i < thr; i++) {
        args[i] = (thread_args_t *) malloc(sizeof(thread_args_t));
        thread_args_init(args[i], i, thr, inc, test, start_barrier);
        threads[i] = (pthread_t *) malloc(sizeof(pthread_t));
        if(pthread_create(threads[i], NULL, sync_function, (void *) args[i])) {
            fprintf(stderr, "Uh oh, I couldn't create thread #%d for you :(\n", i);
            exit(-1);
        }
    }

    // the four legendary barrier waits
    // #1: signal counter & start time initialization
    wait_on_barrier(start_barrier);
    // #2: signal threads to begin work
    wait_on_barrier(start_barrier);
    // #3: signal end time collection and other wrap-up stuff
    wait_on_barrier(start_barrier);
    // #4: wait on all threads for safe collection
    wait_on_barrier(start_barrier);

    // aggregate stats and collect memory
    results->exec_time = args[0]->end_time - args[0]->start_time;
    results->final_count = the_count;
    for(i = 0; i < thr; i++) {
        results->times_incremented[i] = args[i]->times_incremented;
        free(threads[i]);
        free(args[i]);
    }
    free(threads);
    free(args);
    free(start_barrier);

    return results;
}

void *sync_no_sync(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time
    if(id == 0) {
        the_count = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            the_count++;
        }
    } else {
        while(1) {
            if(the_count >= inc)
                break;
            the_count++;
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_pthread_lock(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time
    if(id == 0) {
        the_count = 0;
        if(pthread_mutex_init(&mutex_pthread_lock, NULL)) {
            fprintf(stderr, "Uh oh, I couldn't initialize that pthread mutex lock for you :(\n");
            exit(-1);
        }
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            pthread_mutex_lock(&mutex_pthread_lock);
            the_count++;
            pthread_mutex_unlock(&mutex_pthread_lock);
        }
    } else {
        while(1) {
            pthread_mutex_lock(&mutex_pthread_lock);
            if(the_count >= inc) {
                pthread_mutex_unlock(&mutex_pthread_lock);
                break;
            }
            the_count++;
            pthread_mutex_unlock(&mutex_pthread_lock);
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_tas(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        the_count = 0;
        mutex_tas_lock = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            tas_acquire(&mutex_tas_lock);
            the_count++;
            tas_release(&mutex_tas_lock);
        }
    } else {
        while(1) {
            tas_acquire(&mutex_tas_lock);
            if(the_count >= inc) {
                tas_release(&mutex_tas_lock);
                break;
            }
            the_count++;
            tas_release(&mutex_tas_lock);
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_tatas(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        the_count = 0;
        mutex_tas_lock = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            tatas_acquire(&mutex_tas_lock);
            the_count++;
            tatas_release(&mutex_tas_lock);
        }
    } else {
        while(1) {
            tatas_acquire(&mutex_tas_lock);
            if(the_count >= inc) {
                tatas_release(&mutex_tas_lock);
                break;
            }
            the_count++;
            tatas_release(&mutex_tas_lock);
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_tatas_backoff(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        the_count = 0;
        mutex_tas_lock = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            tatas_backoff_acquire(&mutex_tas_lock);
            the_count++;
            tatas_backoff_release(&mutex_tas_lock);
        }
    } else {
        while(1) {
            tatas_backoff_acquire(&mutex_tas_lock);
            if(the_count >= inc) {
                tatas_backoff_release(&mutex_tas_lock);
                break;
            }
            the_count++;
            tatas_backoff_release(&mutex_tas_lock);
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_ticket(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        the_count = 0;
        mutex_ticket_lock.next_ticket = 0;
        mutex_ticket_lock.now_serving = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            ticket_acquire(&mutex_ticket_lock);
            the_count++;
            ticket_release(&mutex_ticket_lock);
        }
    } else {
        while(1) {
            ticket_acquire(&mutex_ticket_lock);
            if(the_count >= inc) {
                ticket_release(&mutex_ticket_lock);
                break;
            }
            the_count++;
            ticket_release(&mutex_ticket_lock);
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_mcs(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;
    mcs_qnode_t mutex_mcs_node;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    //mutex_mcs_node = (mcs_qnode_t *) malloc(sizeof(mcs_qnode_t));
    mutex_mcs_node.flag = 0;
    mutex_mcs_node.next = NULL;
    if(id == 0) {
        the_count = 0;
        mutex_mcs_lock = NULL;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            mcs_acquire(&mutex_mcs_lock, &mutex_mcs_node);
            the_count++;
            mcs_release(&mutex_mcs_lock, &mutex_mcs_node);
        }
    } else {
        while(1) {
            mcs_acquire(&mutex_mcs_lock, &mutex_mcs_node);
            if(the_count >= inc) {
                mcs_release(&mutex_mcs_lock, &mutex_mcs_node);
                break;
            }
            the_count++;
            mcs_release(&mutex_mcs_lock, &mutex_mcs_node);
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_fai(void *args_void) {
    thread_args_t *args;
    int id, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;
    mcs_qnode_t *mutex_mcs_node;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        fai_count = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    if(mode == EVERY) {
        for(i = 0; i < inc; i++) {
            fai(&fai_count);
        }
    } else {
        while(1) {
            volatile unsigned int oldval = fai(&fai_count);
            if(oldval == inc - 1) {
                inc_counter++;
                break;
            } else if(oldval > inc - 1) {
                faa(&fai_count, -1);
                break;
            }
            inc_counter++;
        }
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        the_count = fai_count;
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_pthread_bar(void *args_void) {
    thread_args_t *args;
    int id, amt, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    amt = args->thread_amt;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        the_count = 0;
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    for(i = 0; i < inc; i++) {
        pthread_cond_barrier(amt, &barrier_mutex, &barrier_cond);
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_sense_rev(void *args_void) {
    thread_args_t *args;
    int id, amt, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    amt = args->thread_amt;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        the_count = 0;
        thread_sense = (volatile unsigned int *) malloc(sizeof(volatile unsigned int) * amt);
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    for(i = 0; i < inc; i++) {
        sense_reversing_barrier(amt, id, thread_sense);
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void *sync_tree_bar(void *args_void) {
    thread_args_t *args;
    int id, amt, inc, mode, i;
    double start, end;
    unsigned long long inc_counter;
    pthread_barrier_t *barrier;
    tree_node_t *my_leaf;
    bool sense;

    // unpack arguments
    args = (thread_args_t *) args_void;
    id = args->thread_id;
    amt = args->thread_amt;
    inc = args->thread_inc;
    mode = args->testing_mode;
    start = 0.0;
    end = 0.0;
    inc_counter = 0;
    barrier = args->start_barrier;
    sense = true;

    // #1: wait for all threads to arrive, then start
    wait_on_barrier(barrier);

    // #2: wait for thread 0 to have the start time + initialize the lock
    if(id == 0) {
        int i;
        the_count = 0;
        build_tree_barrier(&tree_barrier_nodes, &tree_barrier_leaves, TREE_FAN, amt, &tree_barrier_node_amt);
        /*for(i = 0; i < amt; i++) {
            fprintf(stdout, "[%d]: %p -> %p\n", i, tree_barrier_leaves[i], tree_barrier_leaves[i]->parent);
        }
        fflush(stdout);*/
        start = gethrtime_x86();
    }
    wait_on_barrier(barrier);

    // #3: do the experiments
    my_leaf = tree_barrier_leaves[id];
    for(i = 0; i < inc; i++) {
        tree_barrier(my_leaf, &sense);
    }
    wait_on_barrier(barrier);

    // #4: wait for thread 0 to have the end time
    if(id == 0) {
        end = gethrtime_x86();
        args->start_time = start;
        args->end_time = end;
    }
    args->times_incremented = inc_counter;
    wait_on_barrier(barrier);

    pthread_exit(NULL);
}

void thread_args_init(thread_args_t *args, int id, int thr, int inc, int test, pthread_barrier_t *bar) {
    args->thread_id = id;
    args->thread_amt = thr;
    args->thread_inc = inc;
    args->testing_mode = test;
    args->start_time = 0.0;
    args->end_time = 0.0;
    args->times_incremented = 0;
    args->start_barrier = bar;
}

static inline void wait_on_barrier(pthread_barrier_t *bar) {
    // helper function for waiting on pthreads barrier
    // so I don't have to copy+paste this snippet a million times...
    int barrier_stat;
    barrier_stat = pthread_barrier_wait(bar);
    if(barrier_stat != 0 && barrier_stat != PTHREAD_BARRIER_SERIAL_THREAD) {
        fprintf(stderr, "Uh oh, can't wait on the barrier for some reason :(\n");
        exit(-1);
    }   
}
