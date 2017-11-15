/**
 * Table sorting and filtering tool
 *
 * @author  Shushik <silkleopard@yandex.ru>
 * @version 2.0
 *
 * @class TSFT
 */
var TSFT = TSFT || (function() {

    class self {

        /**
         * @constructor
         *
         * @param {object} args
         */
        constructor(args) {
            // Generate instance id
            this._slug = Math.random().toString(16);

            // Bind some methods to the instance context
            this._route = this._route.bind(this);

            // Create module
            this._wait = {};

            // Create module timers stack
            this._timers = {};

            // Initiate data and view modules
            this._data = new Worker(self.Conf.WORKER_LINK);
            this._view = new self.View({target : args.target});

            // Set events handlers
            this._live();

            // Set data
            this._data.postMessage({
                request : 'init data',
                source  : {
                              slug : this._slug,
                              sort : args.sort,
                              cols : args.cols,
                              rows : args.rows
                          }
            });
        }

        /**
         * Set events handlers
         *
         * @private
         * @method _die
         */
        _die() {
            this._data.removeEventListener('message', this._route);
            window.removeEventListener('message', this._route);
        }

        /**
         * Set events handlers
         *
         * @private
         * @method _live
         */
        _live() {
            this._data.addEventListener('message', this._route);
            window.addEventListener('message', this._route);
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
            if (!event.data.slug || event.data.slug != this._slug) {
                return;
            }

            var
                alias = event.data.request ?
                        'request ' + event.data.request :
                        'response ' + event.data.response;

            switch (alias) {
                // Run data table order
                case 'request order rows':
                    this._data.postMessage({
                        slug    : this._slug,
                        request : 'order rows',
                        source  : event.data.source
                    });
                    break;
                // Run data table filtering
                case 'request filter rows':
                    this._data.postMessage({
                        slug    : this._slug,
                        request : 'filter rows',
                        source  : event.data.source
                    });
                    break;
                // Run view table unlock action
                case 'response unlock view':
                    this._view.postMessage({
                        slug    : this._slug,
                        request : 'unlock view'
                    });
                    break;
                // Run view init actions
                case 'response init data':
                    this._view.postMessage({
                        request : 'init view',
                        source  : {
                            slug : this._slug
                        }
                    });
                    break;
                // Run data columns selection
                case 'response init view':
                    this._data.postMessage({
                        slug    : this._slug,
                        request : 'select cols'
                    });
                    break;
                // Run data cell selection success handler
                case 'response select cell':
                    if (this._wait['select cell'] && this._wait['select cell'].success) {
                        this._wait['select cell'].success(event.data.source);
                    }
                    break;
                // Run view table columns rendering
                case 'response select cols':
                    this._view.postMessage({
                        slug    : this._slug,
                        request : 'render cols',
                        source  : event.data.source
                    });
                    break;
                // Run view table rows or none rendering
                case 'response select rows':
                    if (event.data.source.list && event.data.source.list.length) {
                        this._view.postMessage({
                            slug    : this._slug,
                            request : 'render rows',
                            source  : event.data.source
                        });
                    } else {
                        this._view.postMessage({
                            slug    : this._slug,
                            request : 'render none'
                        });
                    }
                    break;
                // Run data table rows selection
                case 'request select rows':
                case 'response order rows':
                case 'response filter rows':
                case 'response render cols':
                    this._data.postMessage({
                        slug    : this._slug,
                        request : 'select rows',
                        source  : {
                                      start : event.data.source && event.data.source.loop ?
                                              event.data.source.loop :
                                              0,
                                      limit : self.Conf.TABLE_ROWS_LIMIT
                                  }
                    });
                    break;
                // Run data table columns count
                case 'response render rows':
                    this._data.postMessage({
                        slug    : this._slug,
                        request : 'count cols'
                    });
                    break;
                // Run view table totals rendering
                case 'response count cols':
                    this._view.postMessage({
                        slug    : this._slug,
                        request : 'render totals',
                        source  : event.data.source
                    });
                    break;
            }
        }

        /**
         * Request table values from data
         *
         * @method request
         *
         * @param {string}   subject
         * @param {object}   args
         * @param {function} success
         * @param {function} error
         *
         * @returns {object}
         */
        request(subject, args, success, error) {
            // Call error handler for the previous promise
            if (this._wait[subject]) {
                this._wait[subject].error();
            }

            // Create promise
            return new Promise((success, error) => {
                // Cache error and success handlers
                this._wait[subject] = {
                    error   : error,
                    success : success
                };

                // Send data request
                this._data.postMessage({
                    slug    : this._slug,
                    request : subject,
                    source  : args
                });

                // Quit by timeout
                if (typeof error == 'function') {
                    this._timers[subject] = setTimeout(
                        error,
                        self.Conf.TABLE_REQUEST_TIMEOUT
                    );
                }
            }).then(success).catch(error);
        }

        /**
         * Uninstall module
         */
        uninstall() {
            this._die();

            this._data.terminate();

            delete this._data;
            delete this._slug;
            delete this._view;
            delete this._route;
        }

    }

    return self;

})();

/**
 * Table config
 *
 * @class TSFT.Conf
 */
TSFT.Conf = TSFT.Conf || (function() {

    class self {

        /**
         * If table can be loaded by scroll
         *
         * @static
         * @const {boolean} TABLE_LOADS_ONSCROLL
         */
        static get TABLE_LOADS_ONSCROLL() {
            return true;
        }

        /**
         * Default table rows loading limit
         *
         * @static
         * @const {number} TABLE_ROWS_LIMIT
         */
        static get TABLE_ROWS_LIMIT() {
            return 50;
        }

        /**
         * Table order action timeout
         *
         * @static
         * @const {number} TABLE_ORDER_DELAY
         */
        static get TABLE_ORDER_DELAY() {
            return 150;
        }

        /**
         * Table filter action timeout
         *
         * @static
         * @const {number} TABLE_FILTER_DELAY
         */
        static get TABLE_FILTER_DELAY() {
            return 300;
        }

        /**
         * Table requests timeout
         *
         * @static
         * @const {number} TABLE_REQUEST_TIMEOUT
         */
        static get TABLE_REQUEST_TIMEOUT() {
            return 1500;
        }

        /**
         * Default CSS code
         *
         * @static
         * @const {string} TABLE_CSS_CODE
         */
        static get TABLE_CSS_CODE() {
            return '' +
                '*{font-size:100%}' +
                '.cells{font:normal 12px/14px Arial, Verdana, sans-serif;position:relative;padding-bottom:25px;margin:0;color:rgb(0, 0, 0)}' +
                '.cells_are_waiting::after{font-size:9px;line-height:9px;text-align:center;content:attr(data-wait);display:block;position:fixed;top:0;right:0;z-index:100500;padding:3px 10px;background:rgb(251, 247, 222);border-color:rgb(177, 177, 177);border-style:solid;border-width:0 0 1px 1px}' +
                '.cells_are_waiting::before{content:"";cursor:progress;display:block;position:fixed;top:0;right:0;bottom:0;left:0;z-index:100500;background:rgba(0, 0, 0, 0.2)}' +
                '.cells_view_rows .cells__none,.cells_view_none .cells__rows,.cells_no_bwd .cells__bwd,.cells_no_fwd .cells__fwd{display:none}' +
                '.cells__col_is_ordered{background:rgba(241, 244, 247, 0.7)}' +
                '.cells__hat{white-space:nowrap;text-align:left;vertical-align:top;padding:0;border-color:transparent rgb(177, 177, 177) transparent rgb(255, 255, 255);border-style:solid;border-width:0 1px}' +
                '.cells__hat:last-child{border-right-width:0}' +
                '.cells__hat:first-child{border-left-width:0}' +
                '.cells__hat_is_sortable .cells__title,.cells__hat_is_sortable .cells__total{cursor:pointer}' +
                '.cells__hat_is_sortable .cells__title{position:relative;padding-right:16px}' +
                '.cells__hat_is_sortable .cells__title::after{content:"";display:block;position:absolute;right:5px;top:8px;border-color:transparent;border-style:solid;border-width:0 3px}' +
                '.cells__hat_is_ordered{background:rgb(216, 219, 221)}' +
                '.cells__hat_is_ordered.cells__hat_by_asc .cells__title::after{border-top-color:inherit;border-top-width:3px}' +
                '.cells__hat_is_ordered.cells__hat_by_desc .cells__title::after{border-bottom-color:inherit;border-bottom-width:3px}' +
                '.cells__hat_is_filterable .cells__filter{background:rgb(255, 255, 255)}' +
                '.cells__body{font-size:13px;line-height:15px}' +
                '.cells__body .cells__row:nth-child(odd){background:rgba(241, 244, 247, 0.7)}' +
                '.cells__body .cells__cell{border-color:rgb(255, 255, 255) transparent rgba(237, 237, 237, 1) transparent;border-style:solid;border-width:1px 0}' +
                '.cells__cell{padding:3px 6px;-webkit-box-sizing:border-box;box-sizing:border-box}' +
                '.cells__head{position:sticky;top:0;bottom:0;background:rgb(228, 232, 237);border-bottom:rgb(177, 177, 177) solid 1px}' +
                '.cells__load{font-size:11px;line-height:15px;position:fixed;right:0;bottom:0;left:0;height:25px;-webkit-box-sizing:border-box;box-sizing:border-box;background:rgb(228, 232, 237);border-top:rgb(177, 177, 177) solid 1px}' +
                '.cells__bwd,.cells__fwd,.cells__now{position:absolute;top:5px}' +
                '.cells__now{text-align:center;right:45%;left:45%}' +
                '.cells__now::before{content:attr(data-from) " – " attr(data-till)}' +
                '.cells__bwd,.cells__fwd{cursor:pointer;-webkit-user-select:none;-moz-user-select:none;user-select:none}' +
                '.cells__bwd::before,.cells__fwd::after{content:"";display:inline-block;width:0;height:0;border-color:transparent;border-style:solid;border-width:4px 0}' +
                '.cells__bwd{right:55%}' +
                '.cells__bwd::after{content:attr(data-from) " – " attr(data-till)}' +
                '.cells__bwd::before{margin-right:4px;border-right-color:inherit;border-right-width:4px}' +
                '.cells__fwd{left:55%}' +
                '.cells__fwd::after{margin-left:4px;border-left-color:inherit;border-left-width:4px}' +
                '.cells__fwd::before{content:attr(data-from) " – " attr(data-till)}' +
                '.cells__table{table-layout:fixed;border-spacing:0;border-collapse:separate;-webkit-box-sizing:border-box;box-sizing:border-box}' +
                '.cells__title,.cells__total{padding-right:5px;padding-left:5px;-webkit-user-select:none;-moz-user-select:none;user-select:none}' +
                '.cells__title{font-size:10px;line-height:15px;padding-top:2px}' +
                '.cells__total{font-size:9px;font-weight:normal;padding-bottom:2px;margin-top:-2px}' +
                '.cells__filter{font-weight:normal;cursor:not-allowed;height:14px;overflow:hidden;padding:2px 5px 2px 6px;margin:0 0 0 -1px;border-top:rgb(177, 177, 177) solid 1px}' +
                '.cells__filter:focus{outline:none;box-shadow:0 1px 1px rgb(207, 207, 207) inset, 0 0 2px rgb(255, 217, 78), 0 0 2px rgb(255, 217, 78), 0 0 3px rgb(255, 217, 78)}' +
                '.cells__filter[contenteditable]{cursor:text}';
        }

        /**
         * Worker link
         *
         * @static
         * @const {string} WORKER_LINK
         */
        static get WORKER_LINK() {
            return 'TSFT.Data.js?24';
        }

        /**
         * Table load button text
         *
         * @static
         * @const {string} TABLE_LOAD_TEXT
         */
        static get TABLE_LOAD_TEXT() {
            return 'Load next rows';
        }

        /**
         * Table loading indicator text
         *
         * @static
         * @const {string} TABLE_LOAD_TEXT
         */
        static get TABLE_LOADING_TEXT() {
            return 'Loading ...';
        }

        /**
         * Table empty filtering none result
         *
         * @static
         * @const {string} TABLE_NOTHING_TEXT
         */
        static get TABLE_NOTHING_TEXT() {
            return 'Nothing to show';
        }

        /**
         * Default iframe html code
         *
         * @static
         * @const {string} IFRAME_CODE
         */
        static get IFRAME_CODE() {
            return '' +
                '<!DOCTYPE html>' +
                '<html><head>' +
                    '<meta charset="UTF-8">' +
                    (
                        self.TABLE_CSS_LINK ?
                        '<link rel="stylesheet" type="text/css" href="' + self.TABLE_CSS_LINK + '">' :
                        '<style>' + self.TABLE_CSS_CODE + '</style>'
                    ) +
                    '<title>TSFT</title>' +
                '</head><body class="cells" data-wait="' + self.TABLE_LOADING_TEXT + '">' +
                    '<table class="cells__head cells__table">' +
                        '<colgroup class="cells__cols"></colgroup>' +
                        '<tr class="cells__row"></tr>' +
                    '</table>' +
                    '<table class="cells__body cells__table">' +
                        '<colgroup class="cells__cols"></colgroup>' +
                        '<tbody class="cells__none">' +
                            '<tr class="cells__row">' +
                                '<td class="cells__cell">' + self.TABLE_NOTHING_TEXT + '</td>' +
                            '</tr>' +
                        '</tbody>' +
                        '<tbody class="cells__rows"></tbody>' +
                    '</table>' +
                    '<div class="cells__load">' +
                        '<div class="cells__bwd"></div>' +
                        '<div class="cells__now"></div>' +
                        '<div class="cells__fwd"></div>' +
                    '</div>' +
                '</body></html>';
        }

        /**
         * Iframe styles
         *
         * @static
         * @const {string} IFRAME_CSS
         */
        static get IFRAME_CSS_CODE() {
            return 'max-width:100%;max-height:400px;border:rgb(177, 177, 177) solid 1px';
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

}).call(TSFT);



/**
 * Table view module
 *
 * @class TSFT.View
 */
TSFT.View = TSFT.View || (function() {

    class self {

        /**
         * @constructor
         *
         * @param {object} args
         */
        constructor(args) {
            // No need to go further
            if (!args.target || !(args.target instanceof HTMLElement)) {
                throw new Error('No target node for table given');
            }

            // Init DOM stack
            this._dom = {
                cache  : null,
                iframe : document.createElement('iframe'),
                target : args.target
            };

            // Create data stack
            this._data = {};

            // Create timers stack
            this._timers = {};

            // Bind some methods to the instance context
            this._route        = this._route.bind(this);
            this._routeMessage = this._routeMessage.bind(this);

            // Remove the default iframe properties
            this._dom.iframe.allowTransparency = true;
            this._dom.iframe.frameBorder       = 0;
            this._dom.iframe.src               = 'about:blank';

            // Set styles
            this._dom.iframe.setAttribute('style', self.parent.Conf.IFRAME_CSS_CODE);
            this._dom.iframe.style.top      = '-9000px';
            this._dom.iframe.style.left     = '-9000px';
            this._dom.iframe.style.position = 'absolute';

            // Save the iframe into DOM
            this._dom.target.parentNode.insertBefore(this._dom.iframe, this._dom.target);

            // Fetch main iframe nodes
            this._dom.win = this._dom.iframe.contentWindow;
            this._dom.doc = this._dom.win.document;

            // Clean the iframe auto created content
            this._dom.doc.open('text/html', 'replace');
            this._dom.doc.write(self.parent.Conf.IFRAME_CODE);
            this._dom.doc.close();

            // Set events handlers
            this._live();
        }

        /**
         * Unset events handlers
         *
         * @private
         * @method _die
         */
        _die() {
            this._dom.win.removeEventListener('keyup', this._route);
            this._dom.win.removeEventListener('keydown', this._route);
            this._dom.doc.body.removeEventListener('mousedown', this._route);
            this._dom.iframe.contentWindow.removeEventListener('message', this._routeMessage);
        }

        /**
         * Init iframe DOM
         *
         * @private
         * @method _init
         *
         * @param {object} args
         */
        _init(args) {
            // Set id
            this._slug = args.slug;

            // Set iframe DOM id
            this._dom.iframe.id = 'TSFT_' + this._slug;

            // 
            this._dom.css = this._dom.doc.getElementsByTagName('style')[0];

            // Get most common DOM nodes
            this._dom.bwd  = this._dom.doc.querySelector('.cells__bwd');
            this._dom.fwd  = this._dom.doc.querySelector('.cells__fwd');
            this._dom.now  = this._dom.doc.querySelector('.cells__now');
            this._dom.cols = this._dom.doc.querySelector('.cells__head .cells__row');
            this._dom.rows = this._dom.doc.querySelector('.cells__rows');
            this._dom.wait = this._dom.doc.querySelector('.cells__wait');

            // Show table waiting indicator
            this._wait();

            // Send init finished response
            self.postMessage({
                slug     : this._slug,
                response : 'init view'
            });
        }

        /**
         * Hide table waiting indicator
         *
         * @private
         * @method _wait
         */
        _halt() {
            this._dom.doc.body.classList.remove('cells_are_waiting');
        }

        /**
         * Set events handlers
         *
         * @private
         * @method _live
         */
        _live() {
            this._dom.win.addEventListener('keyup', this._route);
            this._dom.win.addEventListener('keydown', this._route);
            this._dom.doc.body.addEventListener('mousedown', this._route);
            this._dom.iframe.contentWindow.addEventListener('message', this._routeMessage);
        }

        /**
         * Show table waiting indicator
         *
         * @private
         * @method _wait
         */
        _wait() {
            this._dom.doc.body.classList.add('cells_are_waiting');
        }

        /**
         * Order handler
         *
         * @private
         * @method _order
         *
         * @param {object} node
         */
        _order(node) {
            // No need to go further
            if (!node.classList.contains('cells__hat_is_sortable')) {
                return;
            }

            // Remove previously set timer
            if (this._timers.order) {
                clearTimeout(this._timers.order);
                this._timers.order = 0;
            }

            var
                col   = node.classList[1].replace(/cells__hat_id_([\s\S]*)/, '$1'),
                order = 'asc';

            // Get needed corting order
            if (node.classList.contains('cells__hat_is_ordered')) {
                if (node.classList.contains('cells__hat_by_asc')) {
                    order = 'desc';
                }
            }

            // Remove all previosly set order classes
            Array.prototype.slice.
            call(this._dom.doc.querySelectorAll('.cells__col_is_ordered,.cells__hat_is_ordered')).
            forEach(this._unorder, this);

            // Mark cell as ordered
            node.classList.add('cells__hat_is_ordered');
            node.classList.add('cells__hat_by_' + order);

            // Mark column as ordered
            this._dom.doc.
            querySelector('.cells__body .cells__col_id_' + col).
            classList.add('cells__col_is_ordered');

            // Remember cell node for scrolling
            this._dom.col = node;

            // Order request
            this._timers.order = setTimeout(() => {
                // Show table waiting indicator
                this._wait();

                // Send order request
                self.postMessage({
                    slug    : this._slug,
                    request : 'order rows',
                    source  : {
                                  col   : col,
                                  order : order
                              }
                });
            }, self.parent.Conf.TABLE_ORDER_DELAY);
        }

        /**
         * Filter handler
         *
         * @private
         * @method _filter
         *
         * @param {object} node
         */
        _filter(node) {
            // Clear previously set timer
            if (this._timers.filter) {
                clearTimeout(this._timers.filter);
                this._timers.filter = 0;
            }

            // Remember cell node for scrolling
            this._dom.col = node;

            // Filter request
            this._timers.filter = setTimeout(() => {
                // Show table waiting indicator
                this._wait();

                // Create filter values stack
                this._data.filter = {};

                // Collect values from filtering inputs
                Array.prototype.slice.
                call(this._dom.doc.querySelectorAll('.cells__filter')).
                forEach(this._collect, this);

                // Send filter request
                self.postMessage({
                    slug    : this._slug,
                    request : 'filter rows',
                    source  : {values : this._data.filter}
                });

                // Clear filter values stack
                this._data.filter = null;
            }, self.parent.Conf.TABLE_FILTER_DELAY);
        }

        /**
         * Collect values from filtering inputs
         *
         * @private
         * @method _collect
         *
         * @param {object} node
         */
        _collect(node) {
            var
                col = node.parentNode.classList[1].replace(/cells__hat_id_([\s\S]*)/, '$1'),
                val = node.textContent;

            if (val) {
                this._data.filter[col] = val;
            }
        }

        /**
         * Unorder handler
         *
         * @private
         * @method _unorder
         *
         * @param {object} node
         */
        _unorder(node) {
            node.classList.remove('cells__col_is_ordered');
            node.classList.remove('cells__hat_is_ordered');
            node.classList.remove('cells__hat_by_asc');
            node.classList.remove('cells__hat_by_desc');
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
            var
                alias = event.type + '::' + event.target.classList[0];

            switch (alias) {
                // 
                case 'keyup::cells__filter':
                    switch(event.keyCode) {
                        case 13:
                            this._filter(event.target);
                            break;
                    }
                    break;
                // Block default enter key behavior
                case 'keydown::cells__filter':
                    switch(event.keyCode) {
                        case 13:
                            event.preventDefault();
                            break;
                    }
                    break;
                // Go to next or previous page
                case 'mousedown::cells__bwd':
                case 'mousedown::cells__fwd':
                    // Show table waiting indicator
                    this._wait();

                    self.postMessage({
                        slug    : this._slug,
                        request : 'select rows',
                        source  : {loop : event.target.getAttribute('data-from') - 1}
                    });
                    break;
                // Order column
                case 'mousedown::cells__title':
                case 'mousedown::cells__total':
                    if (event.target.parentNode.classList.contains('cells__hat_is_sortable')) {
                        this._order(event.target.parentNode);
                    }
                    break;
            }
        }

        /**
         * Message event router
         *
         * @private
         * @method _routeMessage
         *
         * @param {object} event
         */
        _routeMessage(event) {
            // No need to go further
            if (
                (!event.data.slug || event.data.slug != this._slug) &&
                (!this._slug && event.data.request != 'init view')
            ) {
                return;
            }

            switch (event.data.request) {
                // Init iframe DOM
                case 'init view':
                    this._init(event.data.source);
                    break;
                // Turn waiting mode on
                case 'lock view':
                    this._wait();
                // Turn waiting mode off
                case 'unlock view':
                    this._halt();
                    break;
                // Render columns
                case 'render cols':
                    this._renderCols(event.data.source);
                    break;
                // Render empty result
                case 'render none':
                    this._renderNone();
                    break;
                // Render rows
                case 'render rows':
                    this._renderRows(event.data.source);
                    break;
                // Render columns totals counters
                case 'render totals':
                    this._renderTotals(event.data.source);
                    break;
            }
        }

        /**
         * Setup iframe and table sizes
         *
         * @private
         * @method _adjust
         */
        _adjust() {
            var
                both  = this._dom.adjust.cells.body ? true : false,
                it0   = this._dom.adjust.cells.head ? this._dom.adjust.cells.head.length : 0,
                max   = 0,
                left  = 0,
                width = 0,
                col   = this._dom.col,
                doc   = this._dom.doc.documentElement || this._dom.doc.body;

            // No need to go further
            if (!it0) {
                return;
            }

            // Reset tables width
            this._dom.cols.parentNode.parentNode.width = '';
            this._dom.rows.parentNode.width = '';

            // Set columns width
            while (--it0 > -1) {
                // Get the largest width
                max = both ?
                      Math.max(
                          this._dom.adjust.cells.body[it0].getBoundingClientRect().width,
                          this._dom.adjust.cells.head[it0].getBoundingClientRect().width
                      ) :
                      this._dom.adjust.cells.head[it0].getBoundingClientRect().width;
                max = Math.ceil(max);

                // Set gotten width to columns
                this._dom.adjust.cols.head[it0].width = max;

                if (both) {
                    this._dom.adjust.cols.body[it0].width = max;
                }

                // Count tables width
                width += max;
            }

            // Clear body cells stack
            this._dom.adjust.cells.body = null;

            // Set tables width
            this._dom.cols.parentNode.parentNode.width = width;
            this._dom.rows.parentNode.width = width;

            // Set iframe width and height
            this._dom.iframe.width  = width;
            this._dom.iframe.height = Math.ceil(this._dom.doc.body.getBoundingClientRect().height);

            // Scroll to top
            doc.scrollTop = 0;

            // Scroll to column
            if (
                col &&
                (left = col.offsetLeft + col.getBoundingClientRect().width) &&
                left > doc.getBoundingClientRect().width
            ) {
                doc.scrollLeft = left;
                delete this._dom.col;
            }

            if (this._dom.target) {
                this._dom.target.parentNode.removeChild(this._dom.target);
                this._dom.target = null;
                this._dom.iframe.style.top      = '';
                this._dom.iframe.style.left     = '';
                this._dom.iframe.style.position = '';
            }
        }

        /**
         * render column
         *
         * @private
         * @method _renderCol
         *
         * @param {object} data
         * @param {number} pos
         */
        _renderCol(data, pos) {
            var
                css  = '',
                th   = this._dom.doc.createElement('th'),
                col  = this._dom.doc.createElement('col'),
                copy = null;

            // Set order and other
            th.className = 'cells__hat ' +
                           'cells__hat_id_' + data.id + ' ' +
                           'cells__hat_type_' + data.type.toLowerCase();

            // Render column sort control
            this._renderColSort(th, data);

            // Render column title
            this._renderColTitle(th, data);

            // Render column total viewer
            this._renderColTotal(th, data);

            // Render column filter input
            this._renderColFilter(th, data);

            // Save cell
            this._dom.cols.appendChild(th);
            this._dom.adjust.cells.head.push(th);

            // Save cloned column into both tables
            col.className = 'cells__col cells__col_id_' + data.id;
            this._dom.adjust.cols.body.push(col);
            this._dom.cache.body.appendChild(col);
            col = col.cloneNode();
            this._dom.adjust.cols.head.push(col);
            this._dom.cache.head.appendChild(col);

            // Stylize column
            this._stylizeCol(data, pos);
        }

        /**
         * Render column sort control
         *
         * @private
         * @method _renderColSort
         *
         * @param {object} col
         * @param {object} data
         */
        _renderColSort(col, data) {
            if (data.sortable !== false) {
                col.classList.add('cells__hat_is_sortable');
            }
        }

        /**
         * Render column title
         *
         * @private
         * @method _renderColTitle
         *
         * @param {object} col
         * @param {object} data
         */
        _renderColTitle(col, data) {
            var
                div = this._dom.doc.createElement('div');

            div.className = 'cells__title';
            div.innerHTML = data.title;

            col.appendChild(div);
        }

        /**
         * Render column title
         *
         * @private
         * @method _renderColTotal
         *
         * @param {object} col
         * @param {object} data
         */
        _renderColTotal(col, data) {
            var
                div = this._dom.doc.createElement('div');

            div.className = 'cells__total';
            div.innerHTML = '&nbsp;';

            col.appendChild(div);
        }

        /**
         * Render column filter input
         *
         * @private
         * @method _renderColFilter
         *
         * @param {object} col
         * @param {object} data
         */
        _renderColFilter(col, data) {
            var
                div = this._dom.doc.createElement('div');

            div = this._dom.doc.createElement('div');
            div.className = 'cells__filter';

            if (data.filterable !== false) {
                div.setAttribute('contenteditable', true);
                col.classList.add('cells__hat_is_filterable');
            }

            col.appendChild(div);
        }

        /**
         * Stylize column
         *
         * @private
         * @method _stylizeCol
         *
         * @param {object} data
         * @param {number} pos
         */
        _stylizeCol(data, pos) {
            var
                css = data.css && typeof data.css == 'string' ? data.css : '';

            // Add column width
            if (data.width) {
                css += 'width:' + data.width + ';';
            }

            // Add column text alignment
            if (data.align) {
                css += 'text-align:right;'
            }

            // Add column vertical alignment
            if (data.valign) {
                css += 'vertical-align:' + data.valign + ';'
            }

            // Add column background color
            if (data.bgcolor) {
                css += 'background-color:' + data.bgcolor + ';';
            }

            // Save column CSS
            if (css) {
                this.addCSS('.cells__rows .cells__cell:nth-child(' + (pos + 1) + ')', css);
            }
        }

        /**
         * Render row
         *
         * @private
         * @method _renderRow
         *
         * @param {object} data
         * @param {number} pos
         * @param {object} rows
         */
        _renderRow(data, pos, rows) {
            if (pos == rows.length - 1) {
                this._dom.adjust.cells.body = [];
            }

            this._dom.cache.row = this._dom.doc.createElement('tr');
            this._dom.cache.row.className = 'cells__row cells__row_id_' + data.id;

            data.cells.forEach(this._renderCell, this);

            this._dom.cache.rows.appendChild(this._dom.cache.row);
            this._dom.cache.row = null;
        }

        /**
         * Render cell
         *
         * @private
         * @method _renderCell
         *
         * @param {object} data
         */
        _renderCell(data) {
            var
                td = this._dom.doc.createElement('td');

            td.className = 'cells__cell cells__cell_col_';
            td.innerHTML = data.title;

            this._dom.cache.row.appendChild(td);

            if (this._dom.adjust.cells.body) {
                this._dom.adjust.cells.body.push(td);
            }
        }

        /**
         * Render columns
         *
         * @private
         * @method _renderCols
         *
         * @param {object} data
         */
        _renderCols(data) {
            // Create cache stack
            this._dom.cache = {
                body : this._dom.doc.querySelector('.cells__body .cells__cols'),
                head : this._dom.doc.querySelector('.cells__head .cells__cols'),
                none : this._dom.doc.querySelector('.cells__none .cells__cell')
            };

            // Create resize counting nodes stack
            this._dom.adjust = {
                cols : {
                    body : [],
                    head : []
                },
                cells : {
                    body : null,
                    head : []
                }
            }

            // Render each column
            data.forEach(this._renderCol, this);

            // Set head table width to body table
            this._dom.cache.body.parentNode.width = this._dom.cache.head.parentNode.offsetWidth;

            // Set needed colspan number to nothing to show cell
            this._dom.cache.none.setAttribute('colspan', data.length);

            // Clear cache stack
            this._dom.cache = null;

            // Send action response
            self.postMessage({
                slug     : this._slug,
                response : 'render cols'
            });
        }

        /**
         * Render empty result
         *
         * @private
         * @method _renderNone
         *
         * @param {object} data
         */
        _renderNone() {
            var
                body = this._dom.doc.body;

            // Switch view mode to none
            if (body.classList.contains('cells_view_rows')) {
                body.classList.remove('cells_view_rows');
            }

            if (!body.classList.contains('cells_view_none')) {
                body.classList.add('cells_view_none');
            }

            // Hide back and forward arrows classes
            if (!body.classList.contains('cells_no_bwd')) {
                body.classList.add('cells_no_bwd');
            }

            if (!body.classList.contains('cells_no_fwd')) {
                body.classList.add('cells_no_fwd');
            }

            // Set current position counters to zero
            this._dom.now.setAttribute('data-from', 0);
            this._dom.now.setAttribute('data-till', 0);

            // Clear rows wrapper
            this._dom.rows.innerHTML = '';

            // Setup iframe and table sizes and
            // hide table waiting indicator
            setTimeout(() => {
                this._adjust();
                this._halt();
            }, self.parent.Conf.TABLE_ROWS_LIMIT);

            // Send action response
            self.postMessage({
                slug     : this._slug,
                response : 'render none'
            });
        }

        /**
         * Render rows
         *
         * @private
         * @method _renderRows
         *
         * @param {object} data
         */
        _renderRows(data) {
            var
                left = 0,
                doc  = this._dom.doc,
                body = doc.body;

            // Switch view mode to rows
            if (body.classList.contains('cells_view_none')) {
                body.classList.remove('cells_view_none');
            }

            if (!body.classList.contains('cells_view_rows')) {
                body.classList.add('cells_view_rows');
            }

            // Hide back and forward arrows classes
            body.classList.remove('cells_no_bwd');
            body.classList.remove('cells_no_fwd');

            // Set current position counters
            this._dom.now.setAttribute('data-from', data.now.from + 1);
            this._dom.now.setAttribute('data-till', data.now.till);

            // Show back arrow
            if (data.bwd) {
                this._dom.bwd.setAttribute('data-from', data.bwd.from + 1);
                this._dom.bwd.setAttribute('data-till', data.bwd.till);
            } else {
                body.classList.add('cells_no_bwd');
            }

            // Show forward arrow
            if (data.fwd) {
                this._dom.fwd.setAttribute('data-from', data.fwd.from + 1);
                this._dom.fwd.setAttribute('data-till', data.fwd.till);
            } else {
                body.classList.add('cells_no_fwd');
            }

            // Create cache stack
            this._dom.cache = {
                row  : null,
                rows : doc.createDocumentFragment()
            };

            // Render rows
            data.list.forEach(this._renderRow, this);

            // Clear previously rendered rows
            this._dom.rows.innerHTML = '';

            // Save rendered rows
            this._dom.rows.appendChild(this._dom.cache.rows);

            // Clear cache stack
            this._dom.cache = null;

            // Setup iframe and table sizes and
            // hide table waiting indicator
            setTimeout(() => {
                this._adjust();
                this._halt();
            }, self.parent.Conf.TABLE_ROWS_LIMIT * 4);

            // Send action response
            self.postMessage({
                slug     : this._slug,
                response : 'render rows'
            });
        }

        /**
         * 
         *
         * @private
         * @method _renderTotal
         *
         * @param {object} node
         */
        _renderTotal(node) {
            var
                id  = node.parentNode.classList[1].replace(/cells__hat_id_/, ''),
                val = '&nbsp;';

            if (this._data.totals[id] !== '') {
                val = self.stringifyNumber(self.fixFloat(this._data.totals[id]));

                node.title     = val;
                node.innerHTML = val;
            } else {
                node.innerHTML = val;
            }
        }

        /**
         * 
         *
         * @private
         * @method _renderTotals
         *
         * @param {object} data
         */
        _renderTotals(data) {
            var
                cols = this._dom.cols.querySelectorAll('.cells__total');

            this._data.totals = data;

            Array.prototype.slice.call(cols).forEach(this._renderTotal, this);
        }

        /**
         * Add css code into table stylesheet
         *
         * @method addCSS
         *
         * @param {string} path
         * @param {string} code
         */
        addCSS(path, code) {
            if (this._dom.css.addRule) {
                this._dom.css.addRule(path, code);
            } else if (typeof this._dom.css.cssText == 'string') {
                this._dom.css.cssText = path + '{' + code + '}';
            } else if (this._dom.css.insertRule && this._dom.css.cssRules) {
                this._dom.css.insertRule(path + '{' + code + '}', this._dom.css.cssRules.length);
            } else {
                this._dom.css.appendChild(this._dom.doc.createTextNode(path + '{' + code + '}'));
            }
        }

        /**
         * Send post message command to iframe
         *
         * @method postMessage
         *
         * @param {object} data
         */
        postMessage(data) {
            this._dom.iframe.contentWindow.postMessage(data, '*');
        }

        /**
         * Uninstall view module instance
         *
         * @method uninstall
         */
        uninstall() {
            this._die();
            this._dom.iframe.parentNode.removeChild(this._dom.iframe);

            delete this._dom;
            delete this._data;
            delete this._slug;
            delete this._route;
            delete this._routeMessage;
            delete this._timers;
        }

        /**
         * Round a given float/number up to a desired
         * number of decimal places
         *
         * @static
         * @method fixFloat
         *
         * @param {number} base
         * @param {number} exponent
         *
         * @returns {number}
         */
        static fixFloat(base, exponent = 2) {
            exponent = Math.pow(10, exponent);
            base     = base * exponent;
            base     = Math.round(base);
            base     = base / exponent;

            return base;
        }

        /**
         * Separate thousands and millions with a given separator
         *
         * @static
         * @method stringifyNumber
         *
         * @param {number} num
         * @param {string} sep
         *
         * @returns {string}
         */
        static stringifyNumber(num, sep = ' ') {
            var
                tmp = (num + '').split('.');

            tmp[0] = tmp[0].
                     replace(/(\d)(?=(\d\d\d)+([^\d]|$))/g, '$1' + sep).
                     replace(/Infinity/g, '∞');

            return tmp.join('.');
        }

        /**
         * Send post message command to window
         *
         * @static
         * @method postMessage
         *
         * @param {object} data
         */
        static postMessage(data) {
            window.postMessage(data, '*');
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

}).call(TSFT);
