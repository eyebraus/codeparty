
/**
 * Module dependencies.
 */

var express = require('express')
  , file = require('./routes/file')
  , http = require('http')
  , index = require('./routes/index')
  , path = require('path')
  , stylus = require('stylus');

(function () {
    var app = express();

    app.configure(function () {
        app.set('port', process.env.PORT || 3000);
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.use(express.favicon());
        app.use(express.logger('dev'));
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser());
        if (process.env.APP_CODEPARTY_SECRET) {
            app.use(express.session({ secret: process.env.APP_CODEPARTY_SECRET }));
        } else {
            app.use(express.session());
        }
        app.use(stylus.middleware({
            src: path.join(__dirname, 'public'),
            compile: function (str, path) {
                return stylus(str)
                 .set('filename', path);
            }
        }));
        app.use(app.router);
        app.use(express.static(path.join(__dirname, 'public')));
    });

    // app routes
    app.get('/', index);
    app.get('/index', index);

    app.configure('development', function () {
        app.use(express.errorHandler());
    });

    http.createServer(app).listen(app.get('port'), function () {
        console.log("Express server listening on port " + app.get('port'));
    });
})();