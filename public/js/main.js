
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
            this.element = element;
            this.html = element.html();
            this.text = element.text();
            this.htmlToText = {};
            this.textToHtml = {};

            var tiles = _.without(this.html.split(Line.htmlSplitRegex), '');
            _.each(tiles, function (tile) {
                var htmlIndex = this.html.indexOf(tile)
                  , textIndex = this.text.indexOf(tile);

                this.htmlToText[htmlIndex] = textIndex;
                this.textToHtml[textIndex] = htmlIndex;
            });
        };

        Line.htmlSplitRegex = /(<span(\s+([\w-]+="([^"\s]*\s*)+")?)*>)|(<\/span>)/g; 

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
            var textIndexes = _.key(this.textToHtml)
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

        $('pre .code').on('keyup mouseup', function (e) {
            var selection = null
              , range = null
              , wrap = null;

            if (typeof window.getSelection != 'undefined') {
                selection = window.getSelection();

                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);

                    // get full range of lines spanned
                    var startLine = $(range.startContainer).parents('.line').first()
                      , endLine = $(range.endContainer).parents('.line').first()
                      , lineRangeStart = startLine.prev()
                      , lineRangeEnd = endLine.next();

                    lineRangeStart.nextUntil(lineRangeEnd)
                        .each(function (index, elt) {
                            var element = $(elt)
                              , line = new Line(element)
                              , openTag = '<span class="comment-highlight">'
                              , closeTag = '</span>';

                            // line content can actually be a rather complex hierarchy of spans,
                            // meaning two things:
                            //     a) range offsets are relative to the sub-spans, not the lines
                            //     b) range offsets become inaccurate once we look at raw HTML
                            //        rather than text.
                            // Therefore, if the .line and selection site are the same, we can
                            // just wrap everything easy-peasy. If not, it gets a little hairy -
                            // we must wrap the interior of the child element, as well as the
                            // remainder in .line.

                            if (element.get(0) === startLine.get(0)) {
                                if (element.get(0) === range.startContainer) {
                                    // selection site is the line, and we can just wrap naively
                                    var selectedHtml = line.html.substring(
                                            line.textToHtml(range.startOffset))
                                      , unselectedHtml = line.html.substring(
                                            line.textToHtml(0),
                                            line.textToHtml(range.startOffset));

                                    element.html(unselectedHtml);
                                    element.append(openTag + selectedHtml + closeTag);
                                } else {
                                    // fuck, now we actually gotta do work

                                }
                            } else if (element.get(0) === endLine.get(0)) {
                                if (element.get(0) === range.endContainer) {
                                    // selection site is the line, and we can just wrap naively
                                    var selectedHtml = line.html.substring(
                                            line.textToHtml(0),
                                            line.textToHtml(range.endOffset))
                                      , unselectedHtml = line.html.substring(
                                            line.textToHtml(range.endOffset));

                                    element.html(unselectedHtml);
                                    element.prepend(openTag + selectedHtml + closeTag);
                                } else {
                                    // fuck, now we actually gotta do work

                                }
                            } else {
                                element.wrapInner(openTag + closeTag);
                            }
                        });
                }
            }
        });
    });