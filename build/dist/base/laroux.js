/**
 * laroux.js - A jquery substitute for modern browsers (base bundle)
 *
 * @version v2.0.0
 * @link https://larukedi.github.io/laroux.js
 * @license Apache-2.0
 */
(function () {
    'use strict';

    var top = (typeof global !== 'undefined') ? global : window;

    // core
    top.laroux = function () {
    };
    if (top.$l === undefined) {
        top.$l = laroux;
    }

    laroux.helpers = {
        extendObject: function () {
            var target = Array.prototype.shift.call(arguments),
                isArray = target instanceof Array;

            for (var item in arguments) {
                for (var name in arguments[item]) {
                    // if (isArray) {
                    //     target.push(arguments[item][name]);
                    //     continue;
                    // }

                    /* target[name].constructor === Object */
                    if (target.hasOwnProperty(name) && target[name] instanceof Object) {
                        extendObject(target[name], arguments[item][name]);
                        continue;
                    }

                    target[name] = arguments[item][name];
                }
            }
        },

        toArray: function (obj) {
            var length = obj.length,
                items = new Array(length);

            for (var i = 0; i < length; i++) {
                items[i] = obj[i];
            }
            return items;
        }
    };

    laroux.ns = function (path, obj) {
        var pathSlices = path.split('.'),
            parent = top;

        for (var i = 0, length1 = pathSlices.length; i < length1; i++) {
            var current = pathSlices[i];

            if (parent[current] === undefined) {
                parent[current] = {};
            }

            parent = parent[current];
        }

        if (obj !== undefined) {
            laroux.helpers.extendObject(parent, obj);
        }

        return parent;
    };

}).call(this);

(function () {
    'use strict';

    // events
    laroux.ns('laroux.events', {
        delegates: [],

        add: function (event, fnc) {
            laroux.events.delegates.push({ event: event, fnc: fnc });
        },

        invoke: function (event, args) {
            for (var item in laroux.events.delegates) {
                if (!laroux.events.delegates.hasOwnProperty(item)) {
                    continue;
                }

                if (laroux.events.delegates[item].event != event) {
                    continue;
                }

                laroux.events.delegates[item].fnc(args);
            }
        }
    });

}).call(this);

(function () {
    'use strict';

    // ajax - partially taken from 'jquery in parts' project
    //        can be found at: https://github.com/mythz/jquip/
    laroux.ns('laroux.ajax', {
        corsDefault: false,

        wrappers: {
            registry: {
                'laroux.js': function (data) {
                    if (!data.isSuccess) {
                        console.log('Error: ' + data.errorMessage);
                        return;
                    }

                    var obj;

                    if (data.format === 'json') {
                        obj = JSON.parse(data.object);
                    } else if (data.format === 'script') {
                        /*jshint evil:true */
                        /*jslint evil:true */
                        obj = eval(data.object);
                    } else { // if (data.format == 'xml') {
                        obj = data.object;
                    }

                    return obj;
                }
            },

            set: function (name, fnc) {
                laroux.ajax.wrappers.registry[name] = fnc;
            }
        },

        xDomainObject: false,
        xmlHttpRequestObject: null,
        xDomainRequestObject: null,
        xhr: function (crossDomain) {
            if (laroux.ajax.xmlHttpRequestObject === null) {
                laroux.ajax.xmlHttpRequestObject = new XMLHttpRequest();
            }

            if (crossDomain) {
                if (!('withCredentials' in laroux.ajax.xmlHttpRequestObject) && typeof XDomainRequest !== 'undefined') {
                    laroux.ajax.xDomainObject = true;

                    if (laroux.ajax.xDomainRequestObject === null) {
                        laroux.ajax.xDomainRequestObject = new XDomainRequest();
                    }

                    return laroux.ajax.xDomainRequestObject;
                }
            } else {
                laroux.ajax.xDomainObject = false;
            }

            return laroux.ajax.xmlHttpRequestObject;
        },

        xhrResp: function (xhr, options) {
            var wrapperFunction = xhr.getResponseHeader('X-Response-Wrapper-Function'),
                response;

            if (options.datatype === undefined) {
                response = xhr.responseText;
            } else if (options.datatype === 'json') {
                response = JSON.parse(xhr.responseText);
            } else if (options.datatype === 'script') {
                /*jshint evil:true */
                /*jslint evil:true */
                response = eval(xhr.responseText);
            } else if (options.datatype === 'xml') {
                response = xhr.responseXML;
            } else {
                response = xhr.responseText;
            }

            if (wrapperFunction && (wrapperFunction in laroux.ajax.wrappers.registry)) {
                response = laroux.ajax.wrappers.registry[wrapperFunction](response);
            }

            return {
                response: response,
                wrapperFunc: wrapperFunction
            };
        },

        makeRequest: function (options) {
            var cors = options.cors || laroux.ajax.corsDefault,
                xhr = laroux.ajax.xhr(cors),
                url = options.url,
                timer = null,
                n = 0;

            if (options.timeout !== undefined) {
                timer = setTimeout(
                    function () {
                        xhr.abort();
                        if (options.timeoutFn !== undefined) {
                            options.timeoutFn(options.url);
                        }
                    },
                    options.timeout
                );
            }

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (timer !== null) {
                        clearTimeout(timer);
                    }

                    if (xhr.status < 300) {
                        var res = null,
                            isSuccess = true;

                        try {
                            res = laroux.ajax.xhrResp(xhr, options);
                        } catch (e) {
                            if (options.error !== undefined) {
                                options.error(xhr, xhr.status, xhr.statusText);
                            }

                            laroux.events.invoke('ajaxError', [xhr, xhr.status, xhr.statusText, options]);
                            isSuccess = false;
                        }

                        if (isSuccess) {
                            if (options.success !== undefined && res !== null) {
                                options.success(res.response, res.wrapperFunc);
                            }

                            laroux.events.invoke('ajaxSuccess', [xhr, res.response, res.wrapperFunc, options]);
                        }
                    } else {
                        if (options.error !== undefined) {
                            options.error(xhr, xhr.status, xhr.statusText);
                        }

                        laroux.events.invoke('ajaxError', [xhr, xhr.status, xhr.statusText, options]);
                    }

                    if (options.complete !== undefined) {
                        options.complete(xhr, xhr.statusText);
                    }

                    laroux.events.invoke('ajaxComplete', [xhr, xhr.statusText, options]);
                } else if (options.progress !== undefined) {
                    /*jslint plusplus: true */
                    options.progress(++n);
                }
            };

            if (options.getdata !== undefined && options.getdata !== null) {
                if (options.getdata.constructor === Object) {
                    var queryString = laroux.helpers.buildQueryString(options.getdata);
                    if (queryString.length > 0) {
                        url += ((url.indexOf('?') < 0) ? '?' : '&') + queryString;
                    }
                } else {
                    url += ((url.indexOf('?') < 0) ? '?' : '&') + options.getdata;
                }
            }

            if (options.jsonp !== undefined) {
                url += ((url.indexOf('?') < 0) ? '?' : '&') + 'jsonp=' + options.jsonp;
            }

            if (!laroux.ajax.xDomainObject) {
                xhr.open(options.type, url, true);
            } else {
                xhr.open(options.type, url);
            }

            try {
                if (options.xhrFields !== undefined) {
                    for (var i in options.xhrFields) {
                        if (!options.xhrFields.hasOwnProperty(i)) {
                            continue;
                        }

                        xhr[i] = options.xhrFields[i];
                    }
                }

                var headers = options.headers || {};

                if (!cors) {
                    headers['X-Requested-With'] = 'XMLHttpRequest';

                    if (options.wrapper) {
                        headers['X-Wrapper-Function'] = 'laroux.js';
                    }
                }

                for (var j in headers) {
                    if (!headers.hasOwnProperty(j)) {
                        continue;
                    }

                    xhr.setRequestHeader(j, headers[j]);
                }
            } catch (e) {
                console.log(e);
            }

            if (options.postdata === undefined || options.postdata === null) {
                xhr.send(null);
                return;
            }

            switch (options.postdatatype) {
                case 'json':
                    xhr.send(JSON.stringify(options.postdata));
                    break;
                case 'form':
                    xhr.send(laroux.helpers.buildFormData(options.postdata));
                    break;
                default:
                    xhr.send(options.postdata);
                    break;
            }
        },

        get: function (path, values, successfnc, errorfnc, cors) {
            laroux.ajax.makeRequest({
                type: 'GET',
                url: path,
                datatype: 'html',
                getdata: values,
                wrapper: true,
                cors: cors || laroux.ajax.corsDefault,
                success: successfnc,
                error: errorfnc
            });
        },

        getJson: function (path, values, successfnc, errorfnc, cors) {
            laroux.ajax.makeRequest({
                type: 'GET',
                url: path,
                datatype: 'json',
                getdata: values,
                wrapper: true,
                cors: cors || laroux.ajax.corsDefault,
                success: successfnc,
                error: errorfnc
            });
        },

        getJsonP: function (path, values, method, successfnc, errorfnc, cors) {
            laroux.ajax.makeRequest({
                type: 'GET',
                url: path,
                datatype: 'script',
                getdata: values,
                jsonp: method,
                wrapper: false,
                cors: cors || laroux.ajax.corsDefault,
                success: successfnc,
                error: errorfnc
            });
        },

        getScript: function (path, values, successfnc, errorfnc, cors) {
            laroux.ajax.makeRequest({
                type: 'GET',
                url: path,
                datatype: 'script',
                getdata: values,
                wrapper: false,
                cors: cors || laroux.ajax.corsDefault,
                success: successfnc,
                error: errorfnc
            });
        },

        post: function (path, values, successfnc, errorfnc, cors) {
            laroux.ajax.makeRequest({
                type: 'POST',
                url: path,
                datatype: 'json',
                postdata: values,
                postdatatype: 'form',
                wrapper: true,
                cors: cors || laroux.ajax.corsDefault,
                success: successfnc,
                error: errorfnc
            });
        },

        postJson: function (path, values, successfnc, errorfnc, cors) {
            laroux.ajax.makeRequest({
                type: 'POST',
                url: path,
                datatype: 'json',
                postdata: values,
                postdatatype: 'json',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                },
                wrapper: true,
                cors: cors || laroux.ajax.corsDefault,
                success: successfnc,
                error: errorfnc
            });
        }
    });

}).call(this);

(function () {
    'use strict';

    // timers
    laroux.ns('laroux.timers', {
        data: [],

        set: function (timer) {
            timer.next = Date.now() + timer.timeout;
            laroux.timers.data.push(timer);
        },

        remove: function (id) {
            var targetKey = null;

            for (var item in laroux.timers.data) {
                if (!laroux.timers.data.hasOwnProperty(item)) {
                    continue;
                }

                var currentItem = laroux.timers.data[item];

                if (currentItem.id !== undefined && currentItem.id == id) {
                    targetKey = item;
                    break;
                }
            }

            if (targetKey !== null) {
                laroux.timers.data.splice(targetKey, 1);
                return true;
            }

            return false;
        },

        ontick: function () {
            var now = Date.now();

            var removeKeys = [];
            for (var item in laroux.timers.data) {
                if (!laroux.timers.data.hasOwnProperty(item)) {
                    continue;
                }

                var currentItem = laroux.timers.data[item];

                if (currentItem.next <= now) {
                    var result = currentItem.ontick(currentItem.state);

                    if (result !== false && currentItem.reset) {
                        currentItem.next = now + currentItem.timeout;
                    } else {
                        removeKeys.unshift(item);
                    }
                }
            }

            for (var item2 in removeKeys) {
                if (!removeKeys.hasOwnProperty(item2)) {
                    continue;
                }

                laroux.timers.data.splice(removeKeys[item2], 1);
            }
        }
    });

}).call(this);

(function () {
    'use strict';

    // triggers
    laroux.ns('laroux.triggers', {
        delegates: [],
        list: [],

        set: function (condition, fnc, state) {
            var conditions = laroux.helpers.getAsArray(condition);

            for (var item in conditions) {
                if (!conditions.hasOwnProperty(item)) {
                    continue;
                }

                if (laroux.helpers.aindex(laroux.triggers.list, conditions[item]) === -1) {
                    laroux.triggers.list.push(conditions[item]);
                }
            }

            laroux.triggers.delegates.push({
                conditions: conditions,
                fnc: fnc,
                state: state
            });
        },

        ontrigger: function (triggerName, args) {
            var eventIdx = laroux.helpers.aindex(laroux.triggers.list, triggerName);
            if (eventIdx !== -1) {
                laroux.triggers.list.splice(eventIdx, 1);
            }

            var removeKeys = [];
            for (var item in laroux.triggers.delegates) {
                if (!laroux.triggers.delegates.hasOwnProperty(item)) {
                    continue;
                }

                var count = 0;
                var currentItem = laroux.triggers.delegates[item];

                for (var conditionKey in currentItem.conditions) {
                    if (!currentItem.conditions.hasOwnProperty(conditionKey)) {
                        continue;
                    }

                    var conditionObj = currentItem.conditions[conditionKey];

                    if (laroux.helpers.aindex(laroux.triggers.list, conditionObj) !== -1) {
                        count++;
                        // break;
                    }
                }

                if (count === 0) {
                    currentItem.fnc(
                        {
                            state: currentItem.state,
                            args: laroux.helpers.getAsArray(args)
                        }
                    );
                    removeKeys.unshift(item);
                }
            }

            for (var item2 in removeKeys) {
                if (!removeKeys.hasOwnProperty(item2)) {
                    continue;
                }

                laroux.triggers.delegates.splice(removeKeys[item2], 1);
            }

            // console.log('trigger name: ' + triggerName);
        }
    });

}).call(this);

(function () {
    'use strict';

    // vars
    laroux.ns('laroux.vars', {
        cookiePath: '/',

        getCookie: function (name, defaultValue) {
            var re = new RegExp(encodeURIComponent(name) + '=[^;]+', 'i'),
                match = document.cookie.match(re);

            if (!match) {
                return defaultValue || null;
            }

            return decodeURIComponent(match[0].split('=')[1]);
        },

        setCookie: function (name, value, expires, path) {
            var expireValue = '';
            if (expires) {
                expireValue = '; expires=' + expires.toGMTString();
            }

            document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + expireValue + '; path=' + (path || laroux.vars.cookiePath);
        },

        removeCookie: function (name, path) {
            document.cookie = encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + (path || laroux.vars.cookiePath);
        },

        getLocal: function (name, defaultValue) {
            if (!(name in localStorage)) {
                return defaultValue || null;
            }

            return JSON.parse(localStorage[name]);
        },

        setLocal: function (name, value) {
            localStorage[name] = JSON.stringify(value);
        },

        removeLocal: function (name) {
            delete localStorage[name];
        },

        getSession: function (name, defaultValue) {
            if (!(name in sessionStorage)) {
                return defaultValue || null;
            }

            return JSON.parse(sessionStorage[name]);
        },

        setSession: function (name, value) {
            sessionStorage[name] = JSON.stringify(value);
        },

        removeSession: function (name) {
            delete sessionStorage[name];
        }
    });

}).call(this);

(function () {
    'use strict';

    // date
    laroux.ns('laroux.date', {
        shortDateFormat: 'dd.MM.yyyy',
        longDateFormat: 'dd MMMM yyyy',
        timeFormat: 'HH:mm',

        monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],

        strings: {
            now:     'now',
            later:   'later',
            ago:     'ago',
            seconds: 'seconds',
            aminute: 'a minute',
            minutes: 'minutes',
            ahour:   'a hour',
            hours:   'hours',
            aday:    'a day',
            days:    'days',
            aweek:   'a week',
            weeks:   'weeks',
            amonth:  'a month',
            months:  'months',
            ayear:   'a year',
            years:   'years'
        },

        parseEpoch: function (timespan, limitWithWeeks) {
            if (timespan < 60 * 1000) {
                timespan = Math.ceil(timespan / 1000);

                return timespan + ' ' + laroux.date.strings.seconds;
            }

            if (timespan < 60 * 60 * 1000) {
                timespan = Math.ceil(timespan / (60 * 1000));

                if (timespan === 1) {
                    return laroux.date.strings.aminute;
                }

                return timespan + ' ' + laroux.date.strings.minutes;
            }

            if (timespan < 24 * 60 * 60 * 1000) {
                timespan = Math.ceil(timespan / (60 * 60 * 1000));

                if (timespan === 1) {
                    return laroux.date.strings.ahour;
                }

                return timespan + ' ' + laroux.date.strings.hours;
            }

            if (timespan < 7 * 24 * 60 * 60 * 1000) {
                timespan = Math.ceil(timespan / (24 * 60 * 60 * 1000));

                if (timespan === 1) {
                    return laroux.date.strings.aday;
                }

                return timespan + ' ' + laroux.date.strings.days;
            }

            if (timespan < 4 * 7 * 24 * 60 * 60 * 1000) {
                timespan = Math.ceil(timespan / (7 * 24 * 60 * 60 * 1000));

                if (timespan === 1) {
                    return laroux.date.strings.aweek;
                }

                return timespan + ' ' + laroux.date.strings.weeks;
            }

            if (limitWithWeeks === true) {
                return null;
            }

            if (timespan < 30 * 7 * 24 * 60 * 60 * 1000) {
                timespan = Math.ceil(timespan / (30 * 24 * 60 * 60 * 1000));

                if (timespan === 1) {
                    return laroux.date.strings.amonth;
                }

                return timespan + ' ' + laroux.date.strings.months;
            }

            timespan = Math.ceil(timespan / (365 * 24 * 60 * 60 * 1000));

            if (timespan === 1) {
                return laroux.date.strings.ayear;
            }

            return timespan + ' ' + laroux.date.strings.years;
        },

        getCustomDateString: function (format, date) {
            var now = date || new Date();

            return format.replace(
                /yyyy|yy|MMMM|MMM|MM|M|dd|d|hh|h|HH|H|mm|m|ss|s|tt|t/g,
                function (match) {
                    switch (match) {
                    case 'yyyy':
                        return now.getFullYear();

                    case 'yy':
                        return now.getYear();

                    case 'MMMM':
                        return laroux.date.monthsLong[now.getMonth()];

                    case 'MMM':
                        return laroux.date.monthsShort[now.getMonth()];

                    case 'MM':
                        return ('0' + (now.getMonth() + 1)).substr(-2, 2);

                    case 'M':
                        return now.getMonth() + 1;

                    case 'dd':
                        return ('0' + now.getDate()).substr(-2, 2);

                    case 'd':
                        return now.getDate();

                    case 'hh':
                        var hour1 = now.getHours();
                        return ('0' + (((hour1 % 12) > 0) ? hour1 % 12 : 12)).substr(-2, 2);

                    case 'h':
                        var hour2 = now.getHours();
                        return ((hour2 % 12) > 0) ? hour2 % 12 : 12;

                    case 'HH':
                        return ('0' + now.getHours()).substr(-2, 2);

                    case 'H':
                        return now.getHours();

                    case 'mm':
                        return ('0' + now.getMinutes()).substr(-2, 2);

                    case 'm':
                        return now.getMinutes();

                    case 'ss':
                        return ('0' + now.getSeconds()).substr(-2, 2);

                    case 's':
                        return now.getSeconds();

                    case 'tt':
                        if (now.getHours() >= 12) {
                            return 'pm';
                        }

                        return 'am';

                    case 't':
                        if (now.getHours() >= 12) {
                            return 'p';
                        }

                        return 'a';
                    }

                    return match;
                }
            );
        },

        getDateDiffString: function (date) {
            var now = Date.now(),
                timespan = now - date.getTime(),
                absTimespan = Math.abs(timespan),
                past = (timespan > 0);

            if (absTimespan <= 3000) {
                return laroux.date.strings.now;
            }

            var timespanstring = laroux.date.parseEpoch(absTimespan, true);
            if (timespanstring !== null) {
                return timespanstring +
                    ' ' +
                    (past ? laroux.date.strings.ago : laroux.date.strings.later);
            }

            return laroux.date.getShortDateString(date, true);
        },

        getShortDateString: function (date, includeTime) {
            return laroux.date.getCustomDateString(
                includeTime ? laroux.date.shortDateFormat + ' ' + laroux.date.timeFormat : laroux.date.shortDateFormat,
                date
            );
        },

        getLongDateString: function (date, includeTime) {
            return laroux.date.getCustomDateString(
                includeTime ? laroux.date.longDateFormat + ' ' + laroux.date.timeFormat : laroux.date.longDateFormat,
                date
            );
        }
    });

}).call(this);

/*jslint nomen: true */
(function () {
    'use strict';

    // stack
    laroux.ns('laroux', {
        stack: function (data, depth, top) {
            if (!(this instanceof laroux.stack)) {
                return new this(data, depth, top);
            }

            this._data = {};
            this._depth = depth;
            this._top = top || this;

            if (data) {
                this.setRange(data);
            }
        }
    });

    laroux.stack.prototype.set = function (key, value) {
        // delete this._data[key];

        var type = typeof value;
        switch (type) {
        case 'function':
            this._data[key] = value;

            Object.defineProperty(
                this,
                key,
                {
                    configurable: true,
                    get: function () {
                        return this._data[key]();
                    }
                }
            );
            break;

        default:
            /*
            if (type == 'object') {
                this._data[key] = new laroux.stack(
                    value,
                    this._depth ?
                        this._depth + '.' + key :
                        key,
                    this._top
                );
            } else {
                this._data[key] = value;
            }
            */
            this._data[key] = value;

            Object.defineProperty(
                this,
                key,
                {
                    configurable: true,
                    get: function () {
                        return this._data[key];
                    },
                    set: function (newValue) {
                        var oldValue = this._data[key];
                        if (this._data[key] === newValue) {
                            return;
                        }

                        // this.set(this, key, newValue);
                        this._data[key] = newValue;
                        this._top.onupdate({ scope: this, key: key, oldValue: oldValue, newValue: newValue });
                    }
                }
            );
            break;
        }
    };

    laroux.stack.prototype.setRange = function (values) {
        for (var valueKey in values) {
            if (!values.hasOwnProperty(valueKey)) {
                continue;
            }

            this.set(valueKey, values[valueKey]);
        }
    };

    laroux.stack.prototype.get = function (key, defaultValue) {
        return this[key] || defaultValue || null;
    };

    laroux.stack.prototype.getRange = function (keys) {
        var values = {};

        for (var item in keys) {
            if (!keys.hasOwnProperty(item)) {
                continue;
            }

            values[keys[item]] = this[keys[item]];
        }

        return values;
    };

    laroux.stack.prototype.keys = function () {
        return Object.keys(this._data);
    };

    laroux.stack.prototype.length = function () {
        return Object.keys(this._data).length;
    };

    laroux.stack.prototype.exists = function (key) {
        return (key in this._data);
    };

    laroux.stack.prototype.remove = function (key) {
        if (key in this._data) {
            delete this[key];
            delete this._data[key];
        }
    };

    laroux.stack.prototype.clear = function () {
        for (var item in this._data) {
            if (!this._data.hasOwnProperty(item)) {
                continue;
            }

            delete this[item];
            delete this._data[item];
        }

        this._data = {};
    };

    laroux.stack.prototype.onupdate = function (event) {
    };

}).call(this);
