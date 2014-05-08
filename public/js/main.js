
require.config({
    paths: {
        highlight: '/components/highlight/highlight.pack',
        jquery: '/components/jquery/jquery.min',
        underscore: '/components/underscore/underscore'
    }
});

require([
    'jquery', 'underscore', 'highlight'],
    function ($, _, highlight) {
        // do some postprocessing of the highlighted text
        var postprocess = function (text) {
            var openSpanRegex = /<span(\s+([\w-]+="([^"\s]*\s*)+")?)*>/g
              , closeSpanRegex = /<\/span>/g;

            // tail-recursive helper function for wrapping all code lines in divs
            var lineify = function (unprocessed, processed, openTags, fn) {
                if (unprocessed.length <= 0) {
                    return processed;
                }

                var line = unprocessed[0]
                  , wrappedLine = line
                  , nextUnprocessed = null
                  , nextProcessed = null
                  , nextOpenTags = openTags;

                // find the amount of open and close tags in this line
                var openTagCount = line.match(openSpanRegex) ? line.match(openSpanRegex).length : 0
                  , closeTagCount = line.match(closeSpanRegex) ? line.match(closeSpanRegex).length : 0;

                if (openTagCount > closeTagCount) {
                    // recursively match all open tags
                    var matchOpenTags = function (line, stack, fn) {
                        var openMatches = line.match(openSpanRegex)
                          , closeMatches = line.match(closeSpanRegex)
                          , firstOpenMatch = openMatches && openMatches.length > 0 ? openMatches[0] : null
                          , firstCloseMatch = closeMatches && closeMatches.length > 0 ? closeMatches[0] : null;

                        // no matches; return current results
                        if (!firstOpenMatch && !firstCloseMatch) {
                            return stack;
                        }

                        // take either the first open or close tag
                        var openIndex = line.indexOf(firstOpenMatch)
                          , closeIndex = line.indexOf(firstCloseMatch);

                        if (openIndex >= 0 && closeIndex < 0 || openIndex < closeIndex) {
                            var nextLine = line.slice(openIndex + firstOpenMatch.length)
                              , nextStack = stack.concat([firstOpenMatch]);

                            return fn(nextLine, nextStack);
                        } else if (closeIndex >= 0 && openIndex < 0 || closeIndex < openIndex) {
                            var nextLine = line.slice(closeIndex + firstCloseMatch.length)
                              , nextStack = stack.slice(0, stack.length - 1);

                            return fn(nextLine, nextStack);
                        } else {
                            return stack;
                        }
                    };

                    // push currently unmatched open tags to the stack
                    var newOpenTags = matchOpenTags(line, [], matchOpenTags);
                    nextOpenTags = openTags.concat(newOpenTags);

                    // wrap line in currently open styles
                    _.each(nextOpenTags.reverse(), function (openTag) {
                        wrappedLine = wrappedLine + '</span>';
                    });
                } else if (openTagCount < closeTagCount) {
                    // pop (formerly) unmatched open tags from the stack
                    nextOpenTags = openTags.slice(0, openTags.length - (closeTagCount - openTagCount));

                    // wrap line in currently open styles
                    _.each(openTags.reverse(), function (openTag) {
                        wrappedLine = openTag + wrappedLine;
                    });
                } else {
                    // wrap line in currently open styles
                    _.each(openTags.reverse(), function (openTag) {
                        wrappedLine = openTag + wrappedLine + '</span>';
                    });
                }

                // wrap line in line div
                wrappedLine = '<div class="line-content">' + wrappedLine + '</div>';

                nextUnprocessed = unprocessed.slice(1);
                nextProcessed = processed.concat([wrappedLine]);
                return fn(nextUnprocessed, nextProcessed, nextOpenTags, fn);
            };

            // wrap line numbers and content together
            var postprocessed = lineify(text.split(/\n/g), [], [], lineify);
            return _.reduce(postprocessed, function (fold, content) {
                return {
                    line: fold.line + 1,
                    content: fold.content + '<div class="line"><div class="line-number">' + fold.line + '</div>' + content + '</div>'
                };
            }, { line: 1, content: '' }).content;
        };

        $(document).ready(function () {
            // tabs are the work of Satan, obv
            highlight.configure({ tabReplace: '    ' });

            // fetch a static code file
            $.getJSON('/static-file-service', {
                    name: 'scale.c'
                })
                .done(function (data) {
                    var name = data.name
                      , language = data.language
                      , content = data.content;

                    // set the page's title to filename
                    $('h4').text(name);

                    // add the highlighted content to the code element
                    var highlighted = highlight.highlightAuto(content).value;
                    $('pre .code').html(postprocess(highlighted));
                });
        });
    });