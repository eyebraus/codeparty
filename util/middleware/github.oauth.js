
var _ = require('underscore')._
  , GithubApi = require('github');

module.exports = (function () {
    var isAuthenticated = function (req, res, next) {
        return typeof req.session.accessToken !== 'undefined' && req.session.accessToken !== null;
    };

    var authenticate = function(req, res, next) {

    };

    return function () {
        var github = new GithubApi({
                debug: true,
                protocol: 'https',
                timeout: 3000,
                version: '3.0.0'
            });

        return function (req, res, next) {

        };
    };
})();