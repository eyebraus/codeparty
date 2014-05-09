
var fs = require('fs')
  , highlight = require('highlight.js')
  , path = require('path')
  , _ = require('underscore')._;

module.exports = function (req, res) {
    'use strict';

    var filename = req.query.name;

    var Postprocessor = function () {
        this.openSpanRegex = /<span(\s+([\w-]+="([^"\s]*\s*)+")?)*>/g
        this.closeSpanRegex = /<\/span>/g; 
    };
    
    // perform postprocessing on highlight.js text
    Postprocessor.prototype.process = function (text) {
        // wrap line numbers and content together
        var postprocessed = this.lineify(text.split(/\n/g), [], []);
        return _.reduce(postprocessed, function (fold, content) {
            return {
                line: fold.line + 1,
                content: fold.content + '<div class="line"><div class="line-number">' + fold.line + '</div>' + content + '</div>'
            };
        }, { line: 1, content: '' }).content;
    };

    // correctly open or close unbalanced span tags due to multiline spans
    Postprocessor.prototype.lineify = function (unprocessed, processed, openTags) {
        if (unprocessed.length <= 0) {
            return processed;
        }

        var line = unprocessed[0]
          , wrappedLine = line
          , nextUnprocessed = null
          , nextProcessed = null
          , nextOpenTags = openTags;

        // find the amount of open and close tags in this line
        var openTagCount = line.match(this.openSpanRegex) ? line.match(this.openSpanRegex).length : 0
          , closeTagCount = line.match(this.closeSpanRegex) ? line.match(this.closeSpanRegex).length : 0;

        if (openTagCount > closeTagCount) {
            // push currently unmatched open tags to the stack
            var newOpenTags = this.findOpenTags(line, []);
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
        return this.lineify(nextUnprocessed, nextProcessed, nextOpenTags);
    };

    // finds all open span tags in a highlighted line of code
    Postprocessor.prototype.findOpenTags = function (line, stack) {
        var openMatches = line.match(this.openSpanRegex)
          , closeMatches = line.match(this.closeSpanRegex)
          , firstOpenMatch = openMatches && openMatches.length > 0 ? openMatches[0] : null
          , firstCloseMatch = closeMatches && closeMatches.length > 0 ? closeMatches[0] : null;

        // no matches; return current results
        if (!(firstOpenMatch || firstCloseMatch)) {
            return stack;
        }

        // take either the first open or close tag
        var openIndex = line.indexOf(firstOpenMatch)
          , closeIndex = line.indexOf(firstCloseMatch);

        if (openIndex >= 0 && closeIndex < 0 || openIndex < closeIndex) {
            var nextLine = line.slice(openIndex + firstOpenMatch.length)
              , nextStack = stack.concat([firstOpenMatch]);

            return this.findOpenTags(nextLine, nextStack);
        } else if (closeIndex >= 0 && openIndex < 0 || closeIndex < openIndex) {
            var nextLine = line.slice(closeIndex + firstCloseMatch.length)
              , nextStack = stack.slice(0, stack.length - 1);

            return this.findOpenTags(nextLine, nextStack);
        } else {
            return stack;
        }
    };

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

            // highlight the text and postprocess
            highlight.configure({ tabReplace: '    ' });
            var highlighted = highlight.highlightAuto(data).value
              , content = new Postprocessor().process(highlighted);

            res.render('index', {
                name: filename,
                language: 'c++',
                content: content
            });
        });
};