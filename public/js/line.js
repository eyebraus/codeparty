
require([
    'jquery', 'underscore'],
    function ($, _) {
        var Line = function (element, row) {
            this.element = $(element);
            this.row = row;
            this.state = Line.states.default;
        };

        Line.states = {
            default: 'default',
            invalid: 'invalid',
            active: 'active',
            inactive: 'inactive'
        };

        Line.prototype.activate = function () {
            this.state = Line.states.active;
        };

        Line.prototype.deactivate = function () {
            this.state = Line.states.deactivate;
        };

        Line.prototype.invalidate = function () {
            this.state = Line.states.invalid;
        };

        return Line;
    });