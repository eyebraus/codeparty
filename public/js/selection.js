
define([
    'jquery', 'underscore'],
    function ($, _) {
        var Selection = function (message) {
            this.lines = {};
            this.message = message;
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

        Selection.prototype.activate = function () {
            if (this.state !== Selection.states.invalid) {
                this.state = Selection.states.active;
            }
        };

        Selection.prototype.deactivate = function () {
            if (this.state === Selection.states.active) {
                this.state = Selection.states.inactive;
            }
        };

        Selection.prototype.validate = function () {
            var self = this;

            this.state = this.isValid()
                ? this.state
                : Line.states.invalid;

            _.each(this.lines, function (line) {
                switch (self.state) {
                    case Selection.active:
                        line.activate();
                        break;

                    case Selection.inactive:
                        line.deactivate();
                        break;

                    case Selection.invalid:
                        line.invalidate();
                        break;
                }
            });
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

        Selection.prototype.startRow = function () {
            return _.chain(this.lines).keys()
                .sortBy(function (key) { return key; })
                .first();
        };

        Selection.prototype.endRow = function () {
            return _.chain(this.lines).keys()
                .sortBy(function (key) { return key; })
                .last();
        };

        return Selection;
    });