
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
        var selections = new Selections();

        $('pre .code').on('keyup mouseup', function (e) {
            var textSelection = null
              , range = null
              , wrap = null;

            if (typeof window.getSelection != 'undefined') {
                textSelection = window.getSelection();

                if (textSelection.rangeCount > 0) {
                    range = textSelection.getRangeAt(0);

                    if (range.startContainer !== range.endContainer || range.startOffset !== range.endOffset) {
                        // something was highlighted, so add a new selection!
                        var selection = new Selection()
                          , lines = []
                          , startLine = $(range.startContainer).parents('.line').first()
                          , endLine = $(range.endContainer).parents('.line').first()
                          , lineRangeStart = startLine.prev()
                          , lineRangeEnd = endLine.next()
                          , lineRangeStartIndex = startLine.parent().first().children().index(startLine);

                        lineRangeStart.nextUntil(lineRangeEnd)
                            .each(function (index, elt) {
                                lines.push(new Line(elt, index + lineRangeStartIndex));
                            });

                        selection.addLines(lines);
                        selections.addSelection(selection);
                        selections.select(selection);

                        // remove the browser's current selection
                        textSelection.removeAllRanges();
                    } else {
                        // nothing was highlighted, so try to detect a selection or unselection!
                        var line = $(range.startContainer).parents('.line').first()
                          , lineIndex = line.parent().first().children().index(line)
                          , selection = selections.selectionForRow(lineIndex);

                        if (selection && !selections.isActiveSelection(selection)) {
                            selections.select(selection);
                        } else {
                            selections.unselect();
                        }
                    }

                }
            }
        });
    });