
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

                            if (element.get(0) === startLine.get(0) || element.get(0) === endLine.get(0)) {
                                var startContainer = $(range.startContainer)
                                  , endContainer = $(range.endContainer)
                                  , lineTextStartPoint = 0
                                  , lineTextEndPoint = line.text.length
                                  , startContainerStartPoint = line.getHtmlIndex(0)
                                  , startContainerEndPoint = line.getHtmlIndex(0)
                                  , endContainerStartPoint = line.getHtmlIndex(line.text.length - 1) + 1
                                  , endContainerEndPoint = line.getHtmlIndex(line.text.length - 1) + 1
                                  , infillStartPoint = startContainerEndPoint
                                  , infillEndPoint = endContainerStartPoint;

                                if (element.get(0) === startLine.get(0)) {
                                    var startContainerSubstring = startContainer.text().substring(range.startOffset);
                                    lineTextStartPoint = line.text.indexOf(startContainerSubstring);
                                    startContainerStartPoint = line.getHtmlIndex(lineTextStartPoint);
                                    startContainerEndPoint = line.getHtmlIndex(lineTextStartPoint + startContainerSubstring.length - 1) + 1;
                                    infillStartPoint = line.getHtmlIndex(lineTextStartPoint + startContainerSubstring.length);
                                }

                                if (element.get(0) === endLine.get(0)) {
                                    var endContainerSubstring = endContainer.text().substring(0, range.endOffset);
                                    lineTextEndPoint = line.text.indexOf(endContainerSubstring) + endContainerSubstring.length
                                    endContainerStartPoint = line.getHtmlIndex(lineTextEndPoint - endContainerSubstring.length);
                                    endContainerEndPoint = line.getHtmlIndex(lineTextEndPoint);
                                    infillEndPoint = line.getHtmlIndex(lineTextEndPoint - 1) + 1;
                                }

                                // split the line into constituent substrings
                                var leftUnselected = line.html.substring(0, startContainerStartPoint)
                                  , startContainerSelected =  line.html.substring(startContainerStartPoint, startContainerEndPoint)
                                  , startContainerTrailing = line.html.substring(startContainerEndPoint, infillStartPoint)
                                  , infillSelected = openTag + line.html.substring(infillStartPoint, infillEndPoint) + closeTag
                                  , endContainerLeading = line.html.substring(infillEndPoint, endContainerStartPoint)
                                  , endContainerSelected = line.html.substring(endContainerStartPoint, endContainerEndPoint)
                                  , rightUnselected = line.html.substring(endContainerEndPoint);

                                if (startContainerSelected.length > 0) {
                                    startContainerSelected = openTag + startContainerSelected + closeTag;
                                }

                                if (infillSelected.length > 0) {
                                    infillSelected = openTag + infillSelected + closeTag;
                                }

                                if (endContainerSelected.length > 0) {
                                    endContainerSelected = openTag + endContainerSelected + closeTag;
                                }

                                // sub out the old HTML for the highlighted HTML
                                var highlightedContent = leftUnselected
                                    + startContainerSelected
                                    + startContainerTrailing
                                    + infillSelected
                                    + endContainerLeading
                                    + endContainerSelected
                                    + rightUnselected;
                                element.html(highlightedContent);
                            } else {
                                element.wrapInner(openTag + closeTag);
                            }
                        });
                }
            }
        });
    });