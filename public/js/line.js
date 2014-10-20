
define([
    'jquery', 'underscore'],
    function ($, _) {
        var Line = function (element, row) {
            this.element = $(element);
            this.row = row;
            this.state = Line.states.default;
        };

        Line.classes = {
            default: '',
            invalid: 'invalid-selection',
            active: 'active-selection',
            inactive: 'inactive-selection'
        };

        Line.states = {
            default: 'default',
            invalid: 'invalid',
            active: 'active',
            inactive: 'inactive'
        };

        Line.prototype.activate = function () {
            if (this.state === Line.states.active) {
                return;
            }

            this.state = Line.states.active;
            this._changeClass();
        };

        Line.prototype.deactivate = function () {
            if (this.state === Line.states.inactive) {
                return;
            }

            this.state = Line.states.inactive;
            this._changeClass();
        };

        Line.prototype.invalidate = function () {
            if (this.state === Line.states.invalid) {
                return;
            }

            this.state = Line.states.invalid;
            this._changeClass();
        };

        Line.prototype._changeClass = function () {
            this.element.removeClass(_.values(Line.classes).join(' '));
            this.element.addClass(Line.classes[this.state]);
        };

        return Line;
    });