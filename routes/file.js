
var fs = require('fs')
  , path = require('path');

module.exports = function (req, res) {
    'use strict';

    var filename = req.query.name;

    fs.readFile(path.join(__dirname, '../data/' + filename),
        { encoding: 'utf-8' },
        function (err, data) {
            if (err) {
                res.send(500, {
                    error: true,
                    issue: err
                });
                return;
            }

            res.send({
                name: filename,
                content: data
            });
        });
};
