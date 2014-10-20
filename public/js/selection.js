
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
            var self = this
              , changed = false;

            _.each(lines, function (line) {
                var addResult = self._addLine(line);
                changed = changed || addResult;
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
            var self = this
              , changed = false;

            _.each(lines, function (line) {
                var removeResult = self._removeLine(line);
                changed = changed || removeResult;
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

        Selection.prototype.hasLineAtRow = function (row) {
            return _.has(this.lines, row);
        };

        Selection.prototype.activate = function () {
            if (this.state !== Selection.states.invalid) {
                this.state = Selection.states.active;
                this._propagateState();
            }
        };

        Selection.prototype.deactivate = function () {
            if (this.state === Selection.states.active) {
                this.state = Selection.states.inactive;
                this._propagateState();
            }
        };

        Selection.prototype.validate = function () {
            var self = this;

            this.state = this.isValid()
                ? this.state
                : Selection.states.invalid;

            this._propagateState();
        };

        Selection.prototype._propagateState = function () {
            var self = this;

            _.each(this.lines, function (line) {
                switch (self.state) {
                    case Selection.states.active:
                        line.activate();
                        break;

                    case Selection.states.inactive:
                        line.deactivate();
                        break;

                    case Selection.states.invalid:
                        line.invalidate();
                        break;
                }
            });
        };

        Selection.prototype.isValid = function () {
            return this.isContiguous();
            // return this.isContiguous() && this.hasMessage();
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

        Selection.prototype.hasMessage = function () {
            return this.message && typeof this.message === 'string' && this.message.length > 0;
        };

        Selection.prototype.startRow = function () {
            return _.chain(this.lines).keys()
                .sortBy(function (key) { return key; })
                .first()
                .value();
        };

        Selection.prototype.endRow = function () {
            return _.chain(this.lines).keys()
                .sortBy(function (key) { return key; })
                .last()
                .value();
        };

        return Selection;
    });