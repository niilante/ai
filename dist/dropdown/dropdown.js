angular.module('ai.dropdown', ['ai.helpers'])

.provider('$dropdown', function $dropdown(){

    var defaults = {

            text: 'text',                           // property to use for text values.
            value: 'value',                         // property to use for model values default is text.
            display: false,                         // alt property to use for display values.
            capitalize: undefined,                  // if true display is capitalized. (group is cap also if used).
            searchable: undefined,                  // indicates that the dropdown is searchable.
            placeholder: 'Please Select',           // placeholder text shown on null value.
            btnClass: 'btn-default',                // the class to add to the button which triggers dropdown.
            allowNull: undefined,                   // when true user can select placeholder/null value.
            inline: false,                          // positions element inline.
            shadow: true,                           // when true adds shadow to bottom of list.

            template: 'dropdown.tpl.html',          // the template to use for the dropdown control.
            itemTemplate:
                'dropdown-item.tpl.html',           // template used for list items.
            itemGroupTemplate:
                'dropdown-item-group.tpl.html',
            searchTemplate:
                'dropdown-search.tpl.html',         // template used for searching list.
            addClass: false,                        // adds a class the top level of the component.

            source: [],                             // data source can be csv, object, array of string/object or url.
            params: {},                             // object of data params to pass with server requests.
            queryParam: 'q',                        // the param key used to query on server requests.
            method: 'get',                          // the method to use for requests.

            groupKey: false,                        // the parent primary key to find children by.
            groupDisplay: false,                    // used to display the group name.

            selectClose: undefined,                 // if not false list is closed after selection.
            selectClear: undefined,                 // after selecting value clear item.
            closeClear: undefined,                  // when searchable and on toggle close clear query filter.
            blurClose: undefined,                   // when true list is closed on blur event.

                                                    // all callbacks are returned with $module context.
            onToggled: false,                       // on toggle dropdown state. injects(toggle state, event).
            onSelected: false,                      // callback on select. injects(selected, ngModel, event).
            onFilter: false,                        // callback on filter. injects (filter, event).
            onGroup: false,                         // callback fired on grouping injects (distinct groups, data).
            onReady: false                           // callback on directive loaded. returns

        }, get, set;

    set = function set(key, value) {
        var obj = key;
        if(arguments.length > 1){
            obj = {};
            obj[key] = value;
        }
        defaults = angular.extend(defaults, obj);
    };

    get = [ '$q', '$parse', '$filter', '$http', '$helpers', function get($q, $parse, $filter, $http, $helpers) {

         var baseTemplate = '<button type="button" class="btn ai-dropdown-toggle" ng-click="toggle()" ng-class="{expanded: expanded}">' +
                                '<span class="selected" ng-bind="selected.display">Please Select</span>' +
                                '<span class="caret" ng-class="{ down: !expanded, up: expanded }"></span>' +
                            '</button>' +
                            '<div class="ai-dropdown-wrapper">' +
                                '<div class="ai-dropdown-items" ng-show="expanded">' +
                                '</div>' +
                            '</div>';

        // item template must be wrapped
        // with outer <ul>.
        var itemTemplate =  '<ul>' +
                                '<li ng-repeat="item in items" ng-class="{ active: item.active }">' +
                                    '<a ng-click="select($event, item)">{{item.display}}</a>' +
                                '</li>' +
                            '</ul>';

        // item group template must be
        // wrapped in outer <div>
        var itemGroupTemplate = '<div>' +
                                    '<div ng-repeat="group in items" ng-if="!group.hidden">' +
                                        '<h5 ng-bind="group.display" ng-show="group.display"></h5>' +
                                        '<ul>' +
                                            '<li ng-repeat="item in group.items" ng-class="{ active: item.active }">' +
                                                '<a ng-click="select($event, item)">{{item.display}}</a>' +
                                            '</li>' +
                                        '</ul>' +
                                    '</div>' +
                                '</div>';


        var searchTemplate =  '<input type="text" ng-model="q" ng-change="filter($event, q)" class="ai-dropdown-search form-control" placeholder="search"/>';
        
        $helpers.getPutTemplate(defaults.template, baseTemplate);
        $helpers.getPutTemplate(defaults.itemTemplate, itemTemplate);
        $helpers.getPutTemplate(defaults.itemGroupTemplate, itemGroupTemplate);
        $helpers.getPutTemplate(defaults.searchTemplate, searchTemplate);

        // module factory.
        function ModuleFactory(element, options, attrs) {

            if((!element && !$helpers.isElement(element)) || !options.source)
                return;

            var $module = {},
                scope,
                dropdown,
                button,
                search,
                items,
                nullItem;

            // parse out relevant options
            // from attributes.

            attrs = $helpers.parseAttrs(Object.keys(defaults), attrs);

            options = options || {};
            $module.scope = scope = options.scope || $rootScope.$new();
            $module.options = scope.options = options = angular.extend({}, defaults, attrs, options);

            nullItem = { text: options.placeholder, value: '', display: options.placeholder };

            // normalize source data to same type.
            function normalizeData(data) {
                if(!data)
                    return [];
                var _collection = options.groupKey ? {} : [],
                    display;
                // if string split to array.
                if(angular.isString(data))
                    data = $helpers.trim(data).split(',');
                if(options.allowNull !== false && angular.isArray(_collection))
                    _collection.push(nullItem);
                if(options.allowNull !== false && angular.isObject(_collection))
                    _collection._placeholder = {
                        key: 'placeholder',
                        display: false,
                        hidden: false,
                        items: [nullItem]
                    };
                angular.forEach(data, function (v,k) {
                    if(angular.isString(v)) {
                        display = v = $helpers.trim(v);
                        if(options.capitalize !== false)
                            display = v.charAt(0).toUpperCase() + v.slice(1);
                        // simple string just push to collection.
                        _collection.push({ text: v, value: v, display: display });
                    }
                    if(angular.isObject(v)) {
                        var item = v,
                            displayKey = options.display || options.text;
                        item.text = v[options.text];
                        item.text = item.text.charAt(0).toUpperCase() + item.text.slice(1);
                        item.value = v[options.value] || item.text;
                        item.display = v[displayKey];
                        if(options.capitalize !== false)
                            item.display =  item.display.charAt(0).toUpperCase() + item.display.slice(1);
                        if(!options.groupKey) {
                            _collection.push(item);
                        } else {
                            var groupKey = v[options.groupKey],
                                groupDisplay = v[options.groupDisplay || options.groupKey];
                            if(options.capitalize !== false)
                                groupDisplay = groupDisplay.charAt(0).toUpperCase() + groupDisplay.slice(1);
                            _collection[groupKey] = _collection[groupKey] ||
                                { key: groupKey, display: groupDisplay, hidden: false };
                            _collection[groupKey].items = data.filter(function(i) {
                                return i[options.groupKey] === groupKey;
                            });
                        }
                    }
                });

                return _collection;
            }

            // build params for server request.
            function buildParams(params, q) {
                params = params || {};
                if(q)
                    params[options.queryParam] = q;
                return params;
            }

            // load data using promise.
            function loadData(q) {
                if($helpers.isUrl(options.source)){
                    var method = options.method,
                        params = buildParams(options.params, q);
                    return $q.when($http[method](options.source, { params: params }))
                        .then(function(res) {
                            return normalizeData(res.data);
                        });
                } else {
                    var defer = $q.defer();
                    defer.resolve(normalizeData(options.source));
                    return defer.promise;
                }
            }

            // parse ngDisabled if present.
            function parseDisabled(newVal) {
                if(!button || undefined === newVal)
                    return;
                var isDisabled = $parse(newVal)(scope.$parent);
                if(isDisabled)
                    button.attr('disabled', 'disabled');
                else
                    button.removeAttr('disabled');
            }

            // clears active items.
            function clearActive() {
                angular.forEach(scope.items, function (item) {
                    if(!options.groupKey) {
                        item.active = false;
                    } else {
                        if(item.items){
                            angular.forEach(item.items, function (groupItem) {
                                groupItem.active = false;
                            });
                        }
                    }
                });
            }

            // clear the search filter.
            function clearFilter() {
                $module.q = scope.q = '';
                filter(null, scope.q);
            }

            // find item by value.
            function find(value) {
                if(!value) return;
                var found;
                if(!options.groupKey){
                    found = scope.items.filter(function (item){
                        return item.value === value;
                    })[0];
                    return found;
                } else {
                    angular.forEach(scope.items, function (group) {
                        if(!found) {
                            found = group.items.filter(function(item) {
                                return item.value === value;
                            })[0];
                        }
                    });
                    return found;
                }
            }

            // select item.
            function select(event, item, suppress) {
                var _item = { text: options.placeholder, value: '', display: options.placeholder };
                // clear active item flag.
                clearActive();
                // if not clear on select
                // otherwise set back to
                // default placeholder.
                if(!options.selectClear){
                    if(item) {
                        _item = item;
                        _item.active = true;
                    }
                }
                $module.selected = scope.selected = _item;
                // update ngModel value.
                if(options.model && !suppress) {
                    var model = options.model;
                    // set val too make sure ui updates.
                    element.val(_item.value);
                    model.$setViewValue(_item.value);
                    if(model.$setTouched)
                        model.$setTouched(true);
                }
                // if on select close toggle list.
                if(options.selectClose !== false && !suppress)
                    toggle();
                // clear the filter.
                clearFilter();
                // callback on select funciton.
                if(angular.isFunction(options.onSelected))
                    options.onSelected.call($module, _item, options.model, event);
            }

            // toggle the list.
            function toggle(event) {
                scope.expanded =! scope.expanded;
                $module.expanded = scope.expanded;
                if(!scope.expanded && options.closeClear === true)
                    clearFilter();
                if(scope.expanded)
                    dropdown[0].focus();
                // if a function callback on toggle.
                if(angular.isFunction(options.onToggled))
                    options.onToggled.call($module, scope.expanded, event);
                // closing so clear filter.
                if(options.searchable !== false && !scope.expanded && angular.isFunction(options.closeClear))
                    $module.q = scope.q = undefined;
            }

            // filter the collection.
            function filter(event, q) {
                var filtered = scope.source;
                if(angular.isFunction(options.onFilter)){
                    filtered = options.onFilter.call($module, filtered, event);
                } else {
                    if(!options.groupKey){
                        // filtering std list.
                        filtered = $filter('filter')(scope.source, q);
                    } else {
                        // filtering group list.
                        angular.forEach(filtered, function(v,k) {
                            var _items = $filter('filter')(v.items, q);
                            v.hidden = !_items.length;
                        });
                    }
                }
                $module.items = scope.items = filtered;
            }

            // initialize the module.
            function init() {

                var promises = [];

                // set scope/method vars.
                $module.selected = scope.selected = nullItem;
                $module.expanded = scope.expanded = false;
                $module.q = scope.q = undefined;

                // set scope/module methods.
                $module.toggle = scope.toggle = toggle;
                $module.find = scope.find = find;

                // if calling by instance
                // no event so pass null apply args.
                $module.select = function () {
                    var args = Array.prototype.slice.call(arguments, 0);
                    args = [null].concat(args);
                    select.apply(this, args);
                };
                scope.select = select;

                // when calling by instance
                // no event so pass null apply args.
                $module.filter = function () {
                    var args = Array.prototype.slice.call(arguments, 0);
                    args = [null].concat(args);
                    filter.apply(this, args);
                };
                scope.filter = filter;

                // parse ngDisabled if exists.
                $module.parseDisabled = scope.parseDisabled = parseDisabled;

                // load data.
                loadData().then(function (res) {

                    // add data collection to scope.
                    // store original collection.
                    // and filtered item collection.
                    $module.source = scope.source = res;
                    $module.items = scope.items = res;

                    // add template promises to queue.
                    promises.push($helpers.loadTemplate(options.template || ''));
                    promises.push($helpers.loadTemplate(options.searchTemplate || ''));

                    // add group or base items template.
                    if(options.groupKey)
                        promises.push($helpers.loadTemplate(options.itemGroupTemplate || ''));
                    else
                        promises.push($helpers.loadTemplate(options.itemTemplate || ''));

                    // build the templates.
                    $q.all(promises).then(function(res) {

                        // replace with new template.
                        if(res && res.length) {

                            var vis = options.visibility,
                                visAttrs = '',
                                itemsHtml = '';

                            // create outer wrapper element.
                            dropdown = '<div tabindex="-1"{{ATTRS}}></div>';

                            // check for ng-show
                            if(vis.ngShow)
                                visAttrs += ' ng-show="' + vis.ngShow + '"';

                            // check for ng-hide
                            if(vis.ngHide)
                                visAttrs += ' ng-hide="' + vis.ngHide + '"';

                            // check for ng-if
                            if(vis.ngIf)
                                visAttrs += ' ng-if="' + vis.ngIf + '"';

                            // add ng-if, ng-show, ng-hide
                            // attrs if provided from orig element.
                            // the parent scope is applied.
                            dropdown = dropdown.replace('{{ATTRS}}', visAttrs);

                            // compile with parent scope for ng-attrs.
                            dropdown = angular.element($helpers.compile(scope.$parent, dropdown));

                            // add primary class for styling.
                            dropdown.addClass('ai-dropdown');

                            // check if block display.
                            if(options.inline)
                                dropdown.addClass('inline');

                            // if group add class to main element.
                            if(options.groupKey)
                                dropdown.addClass('group');

                            // if additional class add it.
                            if(options.addClass)
                                dropdown.addClass(options.addClass);

                            // replace the orig. element.
                            // use after as jqlite doesn't
                            // support .before();
                            var prev = options.before;
                            prev.element[prev.method](dropdown);

                            // set content to template html.
                            dropdown.html(res[0]);

                            // get the items container.
                            items = $helpers.findElement('.ai-dropdown-items', dropdown[0], true);
                            items = angular.element(items);

                            if(options.shadow)
                                items.addClass('shadow');

                            // add items and search if required.
                            if(options.searchable !== false)
                                itemsHtml += res[1];

                            // add items template.
                            itemsHtml += res[2];
                            items.html(itemsHtml);

                            // get reference to button.
                            button = $helpers.findElement('button:first-child', dropdown[0], true);
                            button = angular.element(button);
                            button.addClass(options.btnClass);

                            if(options.blurClose !== false) {
                                // find search input
                                // add listener if blurClose
                                search = $helpers.findElement('input', dropdown[0], true);
                                if(search){
                                    search = angular.element(search);
                                    search.on('blur', function (e) {
                                        e.preventDefault();
                                        if(!e.relatedTarget && scope.expanded){
                                            scope.$digest(function () {
                                                toggle(e);
                                            });
                                        }
                                    });
                                }

                                // check for on blur event.
                                dropdown.on('blur', function (e) {
                                    e.preventDefault();
                                    if(!e.relatedTarget && scope.expanded){
                                        scope.$digest(function () {
                                            toggle(e);
                                        });
                                    }
                                });

                            }

                            // disable button
                            if(vis.disabled)
                                button.attr('disabled', 'disabled');

                            // set button to readonly.
                            if(vis.readonly)
                                button.attr('readonly', 'readonly');

                            // parse ng-disabled.
                            if(vis.ngDisabled)
                                parseDisabled(vis.ngDisabled);

                            // compile the contents.
                            $helpers.compile(scope, dropdown.contents());

                            // if onload callback.
                            if(angular.isFunction(options.onReady))
                                options.onReady.call($module);

                        }

                    });

                });

                // don't wait for template just return;
                return $module;

            }

            return init();
        }

        return ModuleFactory;

    }];

    return {
        $get: get,
        $set: set
    };

})

.directive('aiDropdown', [ '$dropdown', function ($dropdown) {

    // get the previous sibling
    // to the current element.
    function prevSibling(elem, ts) {
        try {
            var parents = elem.parent(),
                prevIdx;
            angular.forEach(parents.children(), function (v,k) {
                var child = angular.element(v),
                    _ts = child.attr('_ts_');
                if(ts.toString() === _ts){
                    prevIdx = k -1;
                }
            });
            elem.removeAttr('_ts_');
            if(prevIdx < 0)
                return { element: angular.element(elem.parent()), method: 'prepend' };
            return { element: angular.element(parents.children().eq(prevIdx)), method: 'after' };
        } catch(ex) {
            return false;
        }
    }

    return {
        restrict: 'EAC',
        scope: true,
        require: '^ngModel',
        link: function (scope, element, attrs, ngModel){

            var defaults, options, $module, model,
                tagName, initialized, ts;

            initialized = false;
            ts = new Date().getTime();

            defaults = {
                scope: scope
            };

            function init() {

                // get previous sibling for appending.
                element.attr('_ts_', ts);

                options.before = prevSibling(element, ts);

                // save visibility attrs to object.
                options.visibility = {
                    disabled: false,
                    readonly: false,
                    ngHide: attrs.ngHide,
                    ngShow: attrs.ngShow,
                    ngIf: attrs.ngIf,
                    ngDisabled: attrs.ngDisabled
                };

                // disabled does not contain value
                // if preset set to true.
                if(attrs.disabled)
                    options.visibility.disabled = true;

                // readonly does not contain value
                // if preset set to true.
                if(attrs.readonly)
                    options.visibility.readonly = true;

                // save ref to orig input element.
                options.input = element;

                // hide the orig. element.
                element.css({ display: 'none'});

                // instantiate the module.
                $module = $dropdown(element, options, attrs);

                // we need to monitor ngDisabled if exists
                // as it may change all other attrs
                // are applied to either outer div with parent
                // scope or remain on the original input element.
                if(attrs.ngDisabled) {
                    scope.$watch(attrs.ngDisabled, function (newVal, oldVal){
                        if(newVal === oldVal) return;
                        scope.parseDisabled(newVal);
                    });
                }

                // watch model to set selected.
                scope.$watch(attrs.ngModel, function (newVal, oldVal) {
                    if((!initialized && undefined !== newVal) || newVal !== oldVal){
                        var item = scope.find(newVal);
                        if(!item || (item.value === scope.selected.value)) return;
                        scope.select(null, item, true);
                        initialized = true;
                    }
                });

            }

            // verify valid element type.
            tagName = element.prop('tagName').toLowerCase();
            if(tagName !== 'input')
                return console.error('Invalid element, ai-dropdown requires an input element with ng-model.');

            // get options and model.
            options = scope.$eval(attrs.aiDropdown || attrs.aiDropdownOptions);
            options = angular.extend(defaults, options);

            // define the source & model data.
            options.source = options.source || scope.$eval(attrs.source);
            options.model = ngModel;

            if(undefined === options.source)
                return console.error('ai-dropdown failed to initialize, invalid model.');
            init();

        }

    };

}]);
