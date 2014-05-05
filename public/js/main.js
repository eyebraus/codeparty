
require.config({
    paths: {
        highlight: '/components/highlight/highlight.pack',
        jquery: '/components/jquery/jquery.min',
        underscore: '/components/underscore/underscore-min'
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
                      , content = data.content;

                    // set the page's title to filename
                    $('h4').text(name);

                    // add the highlighted content to the code element
                    $('pre code').html(highlight.highlightAuto(content).value);
                });
        });
    });