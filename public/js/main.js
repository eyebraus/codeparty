
require.config({
    paths: {
        backbone: '/components/backbone/backbone',
        highlight: '/components/highlight/highlight.pack',
        jquery: '/components/jquery/jquery.min',
        underscore: '/components/underscore/underscore'
    }
});

require([
    'jquery', 'underscore', 'highlight'],
    function ($, _, highlight) {
        // mostly for easily mapping text content to the raw HTML
        var Line = function (element) {
            var self = this;
            this.element = element;
            this.html = element.html();
            this.text = element.text();
            this.htmlToText = {};
            this.textToHtml = {};

            var tiles = _.without(this.html.split(Line.htmlSplitRegex), '');
            _.each(tiles, function (tile) {
                var htmlIndex = self.html.indexOf(tile)
                  , textIndex = self.text.indexOf(_.unescape(tile));

                self.htmlToText[htmlIndex] = textIndex;
                self.textToHtml[textIndex] = htmlIndex;
            });
        };

        Line.htmlSplitRegex = /(?:<span(?:\s+(?:[\w-]+="(?:[^"\s]*\s*)+")?)*>)|(?:<\/span>)|(?:&[a-z]+;)/g; 

        Line.prototype.getTextIndex = function (htmlIndex) {
            var htmlIndexes = _.keys(this.htmlToText)
              , lastIndex = -1
              , baseIndex = -1
              , textBaseIndex = -1;

            _.each(htmlIndexes, function (index) {
                if (index > htmlIndex) {
                    return;
                }

                lastIndex = index;
            });

            baseIndex = lastIndex;
            textBaseIndex = this.htmlToText[baseIndex];

            return textBaseIndex + (htmlIndex - baseIndex);
        };

        Line.prototype.getHtmlIndex = function (textIndex) {
            var textIndexes = _.keys(this.textToHtml)
              , lastIndex = -1
              , baseIndex = -1
              , htmlBaseIndex = -1;

            _.each(textIndexes, function (index) {
                if (index > textIndex) {
                    return;
                }

                lastIndex = index;
            })

            baseIndex = lastIndex;
            htmlBaseIndex = this.textToHtml[baseIndex];

            return htmlBaseIndex + (textIndex - baseIndex);
        };

        var Selection = function () {
            var self = this;
            this.lines = {};
            this.state = Selection.states.default;
        };

        Selection.states = {
            default: 'default',
            invalid: 'invalid',
            active: 'active',
            inactive: 'inactive'
        };

        Selection.prototype.addLine = function (line) {
            if (this._addLine(line)) {
                this.validate();
            }
        };

        Selection.prototype.addLines = function (lines) {
            var changed = false;

            _.each(lines, function (line) {
                changed = changed || this._addLine(line);
            });

            if (changed) {
                this.validate();
            }
        };

        Selection.prototype._addLine = function (line) {
            if (!line) {
                return false;
            }

            this.lines[line.row] = line;
            return true;
        };

        Selection.prototype.removeLine = function (line) {
            if (this._removeLine(line)) {
                this.validate();
            }
        };

        Selection.prototype.removeLines = function (lines) {
            var changed = false;

            _.each(lines, function (line) {
                changed = changed || this._removeLine(line);
            });

            if (changed) {
                this.validate();
            }
        };

        Selection.prototype._removeLine = function (line) {
            if (!line || !this.lines[line.row]) {
                return false;
            }

            delete this.lines[line.row];
            return true;
        };

        Selection.prototype.validate = function () {
            this.state = this.isValid()
                ? this.state
                : this.invalid;
        };

        // Lets us know if selection is valid. Right now just a wrapper around isContiguous,
        // but might have additional logic in the future.
        Selection.prototype.isValid = function () {
            return this.isContiguous();
        };

        Selection.prototype.isContiguous = function () {
            var contiguous = true
              , lastKey = null;

            _.chain(this.lines).keys()
                .sortBy(function (key) { return key; })
                .each(function (key) {
                    contiguous = contiguous && (!lastKey || key - lastKey == 1);
                    lastKey = key;
                });

            return contiguous;
        };

        $('pre .code').on('keyup mouseup', function (e) {
            var selection = null
              , range = null
              , wrap = null;

            if (typeof window.getSelection != 'undefined') {
                selection = window.getSelection();

                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);

                    // skip if nothing was actually selected
                    if (range.startContainer === range.endContainer && range.startOffset === range.endOffset) {
                        return;
                    }

                    // get full range of lines spanned
                    var startLine = $(range.startContainer).parents('.line').first()
                      , endLine = $(range.endContainer).parents('.line').first()
                      , lineRangeStart = startLine.prev()
                      , lineRangeEnd = endLine.next();

                    lineRangeStart.nextUntil(lineRangeEnd)
                        .each(function (index, elt) {
                            $(elt).wrapInner('<span class="comment-highlight"></span>');
                        });
                }
            }
        });
    });