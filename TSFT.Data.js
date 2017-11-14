/**
 * Table calculations module
 *
 * @class TSFTData
 */
var TSFTData = TSFTData || (function() {

    class self {

        /**
         * @constructor
         *
         * @param {object} args
         */
        constructor() {
            // Create data stack
            this._data = {};

            // Bind some methods to the instance context
            this._route         = this._route.bind(this);
            this._compareCommon = this._compareCommon.bind(this);

            // Set events handlers
            this._live();
        }

        /**
         * Create memory table structure
         *
         * @private
         * @method _init
         *
         * @param {object} args
         */
        _init(args) {
            // No need to go further
            if (!args.cols || !(args.cols instanceof Array)) {
                throw new Error('No cols array given')
            } else if (!args.rows || !(args.rows instanceof Array)) {
                throw new Error('No rows array given')
            }

            // Set id
            this._slug = args.slug;

            // Create columns structure
            this._data.cols = {
                cache : null,
                items : {},
                order : []
            };

            // Create rows structure
            this._data.rows = {
                store : '',
                cache : null,
                items : {},
                order : []
            };

            // Create sort properties stack
            this._data.sort = {};

            // Create filter properties stack
            this._data.filter = {};

            // Add columns data
            args.cols.forEach(this._addCol, this);

            // Add rows data
            if (args.rows.length) {
                args.rows.forEach(this._addRow, this);
            }

            // Send init finished response
            self.postMessage({
                slug     : this._slug,
                response : 'init data'
            });
        }

        /**
         * Add column
         *
         * @private
         * @method _addCol
         *
         * @param {object} raw
         * @param {number} pos
         */
        _addCol(raw, pos) {
            var
                id   = pos + 1 + '',
                type = typeof raw.type == 'string' && raw.type.match(/(number|date|enum)/) ?
                       raw.type.substring(0, 1).toUpperCase() + raw.type.substring(1) :
                       'String',
                data = {};

            // Save column structure
            data = {
                virtual    : raw.virtual ? true : false,
                sortable   : !raw.virtual && raw.sortable !== false ? true : false,
                countable  : raw.countable !== false ? true : false,
                filterable : raw.filterable !== false ? true : false,
                id         : id,
                css        : raw.css && typeof raw.css == 'string' ? raw.css : '',
                type       : type,
                align      : raw.align == 'right' ? 'right' : '',
                valign     : raw.valign && typeof raw.valign == 'string' ?
                             raw.valign :
                             '',
                title      : raw.title ? raw.title : '#' + id,
                width      : raw.width && typeof raw.width == 'string' ? raw.width : '',
                bgcolor    : raw.bgcolor && typeof raw.bgcolor == 'string' ?
                             raw.bgcolor :
                             '',
                formula    : raw.formula && typeof raw.formula == 'string' ?
                             raw.formula :
                             ''
            };

            // Add specifical fields to column structure
            switch (type) {
                case 'Enum':
                    data.value = raw.value && typeof raw.value == 'string' ?
                                 raw.value :
                                 '';
                    break;
                case 'Number':
                    data.avg = 0;
                    data.max = undefined;
                    data.min = undefined;
                    data.sum = 0;
                    break;
            }

            // Save column settings
            this._data.cols.items[id] = data;

            // Save column id
            this._data.cols.order.push(id);
        }

        /**
         * Add row
         *
         * @private
         * @method _addRow
         *
         * @param {object} raw
         * @param {number} pos
         */
        _addRow(raw, pos) {
            var
                id  = pos + 1 + '';

            // Fill row with the cells
            this._data.rows.cache = [];

            raw.forEach(this._addCell, this);

            // Save row
            this._data.rows.store += (pos ? ',' : '') + id;
            this._data.rows.order.push(id);
            this._data.rows.items[id] = this._data.rows.cache;

            this._data.rows.cache = null;
        }

        /**
         * Add cell
         *
         * @private
         * @method _addRow
         *
         * @param {object} raw
         * @param {number} pos
         */
        _addCell(raw, pos) {
            var
                id    = pos + 1 + '',
                col   = this._data.cols.items[id],
                type  = col.type,
                title = raw.title !== undefined ? raw.title : raw.value + '',
                value = raw.value;

            // Transform raw value into needed
            switch (type) {
                case 'Enum':
                    value = col.value.indexOf(value + '');

                    if (value == -1) {
                        value = 0;
                        title = col.value.split(',')[0];
                    }
                    break;
            }

            // Save cell data
            this._data.rows.cache.push({
                title : title,
                value : value
            });

            // Count column total
            this._countTotal(raw, pos);
        }

        /**
         * Select all columns
         *
         * @private
         * @method _selectCol
         *
         * @param {string} id
         */
        _countCol(id) {
            var
                col     = this._data.cols.items[id],
                formula = '';

            if (!col.virtual) {
                if (formula = col.formula) {
                    formula = formula.replace(
                                  /\{\{[\s]*(avg|max|min|sum)*[\s]\}\}/g,
                                  'this._data.cols.items[\'' + id + '\'].$1'
                              ).replace(
                                  /\{\{[\s]*([^\.]+)\.(avg|max|min|sum)[\s]*\}\}/g,
                                  'this._data.cols.items[\'$1\'].$2'
                              ).replace(
                                  /\{\{[\s]*rows[\s]*\}\}/g,
                                  'this._data.rows.order.length'
                              ).replace(
                                  /\{\{[\s]*([^\.]+)\.rows[\s]*\}\}/g,
                                  'this._data.rows.order.length'
                              ).replace(
                                  /\{\{[\s]*cell\.([^\.]+)\.([^\s]+)\.val[\s]*\}\}/g,
                                  'this._data.rows.items[\'$1\'][\'$2\'].value'
                              );
                    this._data.cols.cache[id] = eval('(' + formula + ')');
                } else {
                    this._data.cols.cache[id] = '';
                }
            }
        }

        /**
         * Select all columns
         *
         * @private
         * @method _selectCol
         *
         * @param {string} id
         */
        _selectCol(id) {
            var
                col = this._data.cols.items[id];

            if (!col.virtual) {
                this._data.cols.cache.push(col);
            }
        }

        /**
         * Count columns totals
         *
         * @private
         * @method _countCols
         */
        _countCols() {
            this._data.cols.cache = {};

            this._data.cols.order.forEach(this._countCol, this);

            self.postMessage({
                slug     : this._slug,
                response : 'count cols',
                source   : this._data.cols.cache
            });

            this._data.cols.cache = null;
        }

        /**
         * Select all columns
         *
         * @private
         * @method _selectCols
         */
        _selectCols() {
            this._data.cols.cache = [];

            this._data.cols.order.forEach(this._selectCol, this);

            self.postMessage({
                slug     : this._slug,
                response : 'select cols',
                source   : this._data.cols.cache
            });

            this._data.cols.cache = null;
        }

        /**
         * Select row
         *
         * @private
         * @method _selectRow
         *
         * @param {object} data
         */
        _selectRow(data) {
            this._data.rows.cache.row = {
                id    : data,
                cells : []
            }

            this._data.rows.items[data].forEach(this._selectCell, this);

            this._data.rows.cache.list.push(this._data.rows.cache.row);

            delete this._data.rows.cache.row;
        }

        /**
         * Order rows
         *
         * @private
         * @method _orderRows
         *
         * @param {string}  col
         * @param {string}  order
         * @param {boolean} filtered
         */
        _orderRows(col, order, filtered) {
            if (!col && !order) {
                if (!filtered) {
                    this._data.rows.order = this._data.rows.store.split(',');
                }
            } else if (!this._data.cols.items[col]) {
                self.postMessage({
                    slug     : this._slug,
                    response : 'unlock view'
                });
                return;
            } else {
                this._data.sort = {
                    pos   : col - 1,
                    col   : col,
                    order : order
                }

                // Run array sort
                this._data.rows.order.sort(this._compareCommon);

                // Run array reverse
                if (order == 'desc') {
                    this._data.rows.order.reverse();
                }
            }

            //
            self.postMessage({
                slug     : this._slug,
                response : 'order rows'
            });
        }

        /**
         * Compare number cells
         *
         * @private
         * @method _compareCommon
         *
         * @param {object} a
         * @param {object} b
         *
         * @returns {number}
         */
        _compareCommon(a, b) {
            var
                ac = this._data.rows.items[a][this._data.sort.pos],
                bc = this._data.rows.items[b][this._data.sort.pos];

            if (ac.value > bc.value) {
                return 1;
            } else if (ac.value < bc.value) {
                return -1;
            } else if (ac.value == bc.value) {
                if (ac.id < bc.id) {
                    return 1;
                } else if (ac.id > bc.id) {
                    return -1;
                }
            }

            return 0;
        }

        /**
         * Filter rows
         *
         * @private
         * @method _filterRows
         *
         * @param {object} values
         */
        _filterRows(values) {
            var
                check = false,
                al0   = '';
            this._data.test = true;

            // 
            this._clearTotals();

            // Create filtering values stack
            this._data.filter = {cols : 0, vals : {}};

            // Turn strings into RegExps
            for (al0 in values) {
                check = true;

                this._data.filter.cols++;

                this._data.filter.vals[al0] = new RegExp(
                    values[al0].
                    replace(/([\.\?}{\]\[])/g, '\\$1').
                    replace(/([^\\]?)\*/, '$1.*'),
                    'i'
                );
            }

           // Restore full list
            this._data.rows.order = this._data.rows.store.split(',');

            if (check) {
                this._data.rows.order = this._data.rows.order.
                                        filter(this._checkRow, this);
            } else {
                this._data.rows.order.forEach(this._countTotals, this);
            }

            // Order using last saved order settings
            if (this._data.sort.col) {
                this._orderRows(this._data.sort.col, this._data.sort.order);
            } else {
                this._orderRows('', '', true);
            }
        }

        /**
         * Filter row
         *
         * @private
         * @method _checkRow
         *
         * @param {string} row
         *
         * @returns {boolean}
         */
        _checkRow(row) {
            var
                check = this._data.rows.items[row].filter(this._checkCell, this);

            if (check.length === this._data.filter.cols) {
                this._countTotals(row);
                return true;
            }

            return false;
        }

        /**
         * Filter cell
         *
         * @private
         * @method _checkCell
         *
         * @param {string} cell
         * @param {number} pos
         *
         * @returns {boolean}
         */
        _checkCell(cell, pos) {
            var
                col = pos + 1 + '';

            if (
                this._data.filter.vals[col] &&
                cell.title.match(this._data.filter.vals[col])
            ) {
                return true;
            }

            return false;
        }

        /**
         * Select rows
         *
         * @private
         * @method _selectRows
         *
         * @param {number} start
         * @param {number} limit
         */
        _selectRows(start, limit) {
            var
                loop = start && typeof start == 'number' ? start : 0,
                last = loop + limit;

            // Get last item position
            last = last > this._data.rows.order.length ?
                   this._data.rows.order.length :
                   last;

            // Create temporary items stack
            this._data.rows.cache = {row : null, list : []};

            // Fill temporary items stack with the values
            if (last) {
                // Get previous page positions
                if (loop) {
                    this._data.rows.cache.bwd = {
                        from : start - limit,
                        till : start
                    }
                }

                // Get next page positions
                if (last < this._data.rows.order.length) {
                    this._data.rows.cache.fwd = {
                        from : last,
                        till : last + limit
                    };

                    if (this._data.rows.cache.fwd.till > this._data.rows.order.length) {
                        this._data.rows.cache.fwd.till = this._data.rows.order.length;
                    }
                }

                // Get current page positions
                this._data.rows.cache.now = {
                    from : loop,
                    till : last
                };

                // Select rows
                this._data.rows.order.slice(loop, last).forEach(this._selectRow, this);
            } else {
                this._data.rows.cache.list = null;
            }

            // Send response message
            self.postMessage({
                slug     : this._slug,
                response : 'select rows',
                source   : this._data.rows.cache
            });

            // Clear temporary items stack
            this._data.rows.cache = null;
        }

        /**
         * Select cell
         *
         * @private
         * @method _selectCell
         *
         * @param {object} data
         * @param {number} pos
         */
        _selectCell(data, pos) {
            var
                id = pos + 1;

            if (typeof data == 'number') {
                data = this._data.rows.items[data];
                data = data instanceof Array ? data[id] : null;
                data = data ? data.value : null;

                // Send response message
                self.postMessage({
                    slug     : this._slug,
                    response : 'select cell',
                    source   : data
                });
            } else if (this._data.cols.items[id].virtual === false) {
                this._data.rows.cache.row.cells.push(data);
            }
        }

        /**
         * Count column totals
         *
         * @private
         * @method _countTotal
         *
         * @param {string} cell
         * @param {number} pos
         */
        _countTotal(cell, pos) {
            var
                id  = pos + 1 + '',
                col = this._data.cols.items[id];

            switch (col.type) {
                case 'Number':
                    col.sum += cell.value;
                    col.avg = col.sum / this._data.rows.order.length;
                    col.max = col.max !== undefined ?
                              Math.max(cell.value, col.max) :
                              cell.value;
                    col.min = col.min !== undefined ?
                              Math.min(cell.value, col.min) :
                              cell.value;
                    break;
            }
        }

        /**
         * Clear column totals
         *
         * @private
         * @method _clearTotal
         */
        _clearTotal(id) {
            var
                col = this._data.cols.items[id];

            if (col.type == 'Number') {
                col.avg = 0;
                col.sum = 0;
                col.max = 0;
                col.min = 0;
            }
        }

        /**
         * Clear columns totals
         *
         * @private
         * @method _clearTotals
         */
        _clearTotals() {
            this._data.cols.order.forEach(this._clearTotal, this);
        }

        /**
         * Count columns totals
         *
         * @private
         * @method _countTotals
         *
         * @param {number} row
         */
        _countTotals(row) {
            this._data.rows.items[row].forEach(this._countTotal, this);
        }

        /**
         * Set events handlers
         *
         * @private
         * @method _live
         */
        _live() {
            self.parent.addEventListener('message', this._route);
        }

        /**
         * Events router
         *
         * @private
         * @method _route
         *
         * @param {object} event
         */
        _route(event) {
            // No need to go further
            if (
                (!event.data.slug || event.data.slug != this._slug) &&
                (!this._slug && event.data.request != 'init data')
            ) {
                return;
            }

            switch (event.data.request) {
                // Init module module data
                case 'init data':
                    this._init(event.data.source);
                    break;
                // Count columns totals
                case 'count cols':
                    this._countCols();
                    break;
                // Select cell data
                case 'select cell':
                    this._selectCell(event.data.source.row, event.data.source.cell);
                    break;
                // Select columns data
                case 'select cols':
                    this._selectCols();
                    break;
                // Order rows
                case 'order rows':
                    this._orderRows(event.data.source.col, event.data.source.order);
                    break;
                // Filter rows
                case 'filter rows':
                    this._filterRows(event.data.source.values);
                    break;
                // Select rows
                case 'select rows':
                    this._selectRows(
                        event.data.source ? event.data.source.start : 0,
                        event.data.source ? event.data.source.limit : 50
                    );
                    break;
            }
        }

        /**
         * Send post message command to main thread
         *
         * @static
         * @method postMessage
         *
         * @param {object} data
         */
        static postMessage(data) {
            self.parent.postMessage(data);
        }

    }

    /**
     * Link to parent module
     *
     * @static
     * @member {object} parent
     */
    self.parent = this;

    return self;

}).call(self);

new TSFTData();
