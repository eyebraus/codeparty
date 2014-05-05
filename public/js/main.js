
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
        // tabs are the work of Satan, obv
        highlight.configure({ tabReplace: '    ' });

        $(document).ready(function () {
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

                    // dice file content into lines and append
                    _.each(data.content.split(/\n/g), function (line, index) {
                        // TODO: templatize me!
                        var lineNumber = '<div class="line-number">' + index + '</div>'
                          , lineContent = '<div class="line-content">' + _.escape(line) + '</div>'
                          , lineDiv = '<div class="line">' + lineNumber + lineContent + '</div>';

                        $('.code').append(lineDiv);
                    });

                    // highlight all lines
                    $('.code .line-content').each(function (index, element) {
                        var unhighlighted = _.unescape($(element).text())
                          , highlighted = highlight.highlight(language, unhighlighted).value;

                        $(element).html(highlighted);
                    });
                });
        });
    });