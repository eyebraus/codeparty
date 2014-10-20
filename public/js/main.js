
require.config({
    paths: {
        backbone: '/components/backbone/backbone',
        highlight: '/components/highlight/highlight.pack',
        jquery: '/components/jquery/jquery.min',
        underscore: '/components/underscore/underscore'
    }
});

require([
    'jquery', 'underscore', 'highlight', 'line', 'selection', 'selections'],
    function ($, _, highlight, Line, Selection, Selections) {
        $('pre .code').on('keyup mouseup', function (e) {
            var textSelection = null
              , range = null
              , wrap = null;

            if (typeof window.getSelection != 'undefined') {
                textSelection = window.getSelection();

                if (textSelection.rangeCount > 0) {
                    range = textSelection.getRangeAt(0);

                    // skip if nothing was actually selected
                    if (range.startContainer === range.endContainer && range.startOffset === range.endOffset) {
                        return;
                    }

                    // get full range of lines spanned
                    var selection = new Selection()
                      , lines = []
                      , startLine = $(range.startContainer).parents('.line').first()
                      , endLine = $(range.endContainer).parents('.line').first()
                      , lineRangeStart = startLine.prev()
                      , lineRangeEnd = endLine.next();

                    lineRangeStart.nextUntil(lineRangeEnd)
                        .each(function (index, elt) {
                            lines.push(new Line(elt, index));
                        });

                    selection.addLines(lines);
                }
            }
        });
    });