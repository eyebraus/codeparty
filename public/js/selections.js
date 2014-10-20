
define([
    'jquery', 'underscore'],
    function ($, _) {
        var Selections = function () {
            this.selections = [];
            this.activeSelection = null;
            this.activeIndex = -1;
        };

        Selections.prototype.addSelection = function (selection) {
            if (!selection || this.selections.indexOf(selection) >= 0) {
                return false;
            }

            this.selections.push(selection);
            this.selections = _.sortBy(this.selections, function (selection) {
                return selection.startRow();
            });

            // make sure the active index is correctly maintained
            if (this.activeSelection) {
                this.activeIndex = this.selections.indexOf(this.activeSelection);
            }

            return true;
        };

        Selections.prototype.removeSelection = function (selection) {
            if (!selection || this.selections.indexOf(selection) < 0) {
                return false;
            }

            var selectionIndex = this.selections.indexOf(selection);
            this.selections.splice(selectionIndex, 1);

            // make sure the active selection and index are correctly maintained
            if (this.activeSelection) {
                this.activeSelection = this.activeSelection == selection ? null : this.activeSelection;
                this.activeIndex = this.selections.indexOf(this.activeSelection);
            }

            return true;
        };

        Selections.prototype.select = function (selection) {
            if (!selection || this.selections.indexOf(selection) < 0) {
                return false;
            }

            return this.selectIndex(this.selections.indexOf(selection));
        };

        Selections.prototype.selectPrevious = function () {
            return this.selectIndex(this.activeIndex - 1);
        };

        Selections.prototype.selectNext = function () {
            return this.selectIndex(this.activeIndex + 1);
        };

        Selections.prototype.selectIndex = function (index) {
            if (index < 0 || index >= this.selections.length) {
                return false;
            }

            if (this.activeIndex !== index) {
                if (this.activeSelection) {
                    this.activeSelection.deactivate();
                }

                this.activeSelection = this.selections[index];
                this.activeIndex = index;
            } else {
                this.activeSelection.deactivate();
                this.activeSelection = null;
                this.activeIndex = -1;
            }

            return true;
        };

        return Selections;
    });
