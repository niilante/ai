
angular.module('ai.flash.factory', [])

    .provider('$flash', function $flash() {

        var defaults, get, set;

        // default settings.
        defaults = {
            template: 'flash.html',                 // the template for flash message.
            html: true,                             // when true html flash messages can be used.(requires ngSanitize)
            errors: true,                           // when true flash is shown automatically on http status errors.
            errorKey: 'err',
            excludeErrors: [401, 403, 404],         // exclude errors by status type.
            errorName: 'Unknown Exception',         // the error name to use in event and error.name is not valid.
            errorMessage: 'An unknown exception ' + // default error message in event one is not provided.
                          'has occurred, if the ' +
                          'problem persists ' +
                          'please contact the ' +
                          'administrator.',
            stack: false,                           // when true stack trace is shown.
            multiple: false,                        // whether to allow multiple flash messages at same time.
            type: 'info',                           // the default type of message to show also the css class name.
            typeError: 'danger',                    // the error type or class name for error messages.
            animation: false,                       // provide class name for animation.
            timeout: 3500,                          // timeout to auto remove flashes after period of time..
                                                    // instead of by timeout.
            onError: undefined                      // function called on error before flashed, return false to ignore.

        };

        // set global provider options.
        set = function (value) {
            defaults = angular.extend(defaults, value);
        };

        // get provider
        get = ['$rootScope', '$q', '$templateCache', '$http', '$timeout', '$compile',
            function ($rootScope, $q, $templateCache, $http, $timeout, $compile) {

            var $module, flashTemplate;


            flashTemplate = '<div class="ai-flash-item" ng-repeat="flash in flashes" ng-mouseenter="enter(flash)" ' +
                            'ng-mouseleave="leave(flash)" ng-class="flash.type">' +
                                '<a class="ai-flash-close" type="button" ng-click="remove(flash)">&times</a>' +
                                '<div class="ai-flash-title" ng-if="flash.title" ng-bind-html="flash.title"></div>' +
                                '<div class="ai-flash-message" ng-bind-html="flash.message"></div>' +
                            '</div>';

            $templateCache.get(defaults.template) || $templateCache.put(defaults.template, flashTemplate);

            function isHtml(str) {
                return /<(br|basefont|hr|input|source|frame|param|area|meta|!--|col|link|option|base|img|wbr|!DOCTYPE).*?>|<(a|abbr|acronym|address|applet|article|aside|audio|b|bdi|bdo|big|blockquote|body|button|canvas|caption|center|cite|code|colgroup|command|datalist|dd|del|details|dfn|dialog|dir|div|dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|frameset|head|header|hgroup|h1|h2|h3|h4|h5|h6|html|i|iframe|ins|kbd|keygen|label|legend|li|map|mark|menu|meter|nav|noframes|noscript|object|ol|optgroup|output|p|pre|progress|q|rp|rt|ruby|s|samp|script|section|select|small|span|strike|strong|style|sub|summary|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|video).*?<\/\2>/.test(str);
            }

            function isPath(str) {
                if(!str || !angular.isString(str)) return false;
                var ext = str.split('.').pop();
                return ext === 'html' || ext === 'tpl';
            }
            
            function isElement(elem) {
                return !!(elem && elem[0] && (elem[0] instanceof HTMLElement));                
            }

            function findElement(q, element) {
                return angular.element((element || document).querySelectorAll(q));
            }

            function loadTemplate(t) {
                // handle html an strings.
                if ((isHtml(t) && !isPath(t)) || (angular.isString(t) && t.length === 0)) {
                    var defer = $q.defer();
                    defer.resolve(t);
                    return defer.promise;
                } else {
                    // handle paths.
                    return $q.when($templateCache.get(t) || $http.get(t))
                        .then(function (res) {
                            if (res.data) {
                                $templateCache.put(t, res.data);
                                return res.data;
                            }
                            return res;
                        });
                }
            }
            
            function overflow(body) {
                var x, y;
                x = body[0].style.overflow || undefined;
                y = body[0].style.overflowY || undefined;
                return {x:x,y:y};
            }

            function tryParseTimeout(to) {
                if(undefined === to)
                    return to;
                try{
                   return JSON.parse(to);
                } catch(ex){
                    return to;
                }
            }

            // The flash factory
            function ModuleFactory() {

                var flashes = [],
                    element,
                    options,
                    scope,
                    body,
                    overflows;

                // uses timeout to auto remove flash message.
                function autoRemove(flash) {
                    clearTimeout(flash.timeoutId);
                    flash.timeoutId = $timeout(function () {
                        if(flash.focus) {
                            clearTimeout(flash.timeoutId);
                            autoRemove(flash);
                        } else {
                            clearTimeout(flash.timeoutId);
                            remove(flash);
                        }

                    }, flash.timeout);
                }
                
                // add a new flash message.
                function add(message, type, title, timeout) {
                    var flashDefaults = {
                            title: undefined,
                            type: options.type,
                            focus: false,
                            show: false,
                            timeout: false
                        }, flash, tmpTitle;
                    title = tryParseTimeout(title);
                    timeout = tryParseTimeout(timeout);
                    // if title is number assume timeout
                    if(angular.isNumber(title) || 'boolean' === typeof title){
                        timeout = title;
                        title = undefined;
                    }
                    if(!options.multiple)
                        flashes = [];
                    // if message is not object create Flash.
                    if(!angular.isObject(message)){
                        flash = {
                            message: message,
                            type: type,
                            title: title,
                            timeout: timeout
                        };
                    }
                    // extend object with defaults.
                    flash = angular.extend({}, angular.copy(flashDefaults), flash);
                    // set the default timeout if true was passed.
                    if(flash.timeout === true)
                        flash.timeout = options.timeout;
                    if(flash.message) {
                        flashes.push(flash);
                        $module.flashes = scope.flashes = flashes;
                        body.css({ overflow: 'hidden'});
                        element.addClass('show');
                        if(flash.timeout)
                            autoRemove(flash);

                    }
                }
                
                // remove a specific flash message.
                function remove(flash) {
                    if(flash && flashes.length) {
                        flashes.splice(flashes.indexOf(flash), 1);
                        if(!flashes.length){
                            body.css({ overflow: overflows.x, 'overflow-y': overflows.y });
                            if(element)
                                element.removeClass('show');
                        }
                    }
                    
                }
                
                // remove all flash messages in collection.
                function removeAll() {
                    if(flashes.length) {
                        angular.forEach(flashes, function (flash) {
                            if(flash.shown === true)
                                remove(flash);
                            else
                                flash.shown = true;
                        });
                    }
                }

                // on flash enter set its focus to true
                // so it is not removed while being read.
                function enter(flash) {
                    flash.focus = true;
                }

                // on leave set the focus to false
                // can now be removed.
                function leave(flash) {
                    flash.focus = false;
                }

                // bind module events.
                function bind() {
                    $module = $module || {};
                    $module.add = add;
                    $module.remove = remove;
                    $module.removeAll = removeAll;
                    $module.flashes = flashes;
                    $module.init  = init;
                    return $module;
                }

                // initialize the element/options.
                function init(_element, _options) {

                    // extend options
                    options = _options || {};
                    element = _element;
                    $module.scope = scope = options.scope || $rootScope.$new();
                    $module.options = scope.options = options = angular.extend(defaults, options);

                    // get overflows and body.
                    body = findElement('body');
                    overflows = overflow(body);

                    // load the template.
                    loadTemplate(options.template).then(function (res) {
                        if(res) {
                            element.html(res);
                            $compile(element.contents())(scope);
                            element.addClass('ai-flash');
                        }
                    });

                    // when route changes be sure
                    // to remove all flashes.
                    $rootScope.$on('$routeChangeStart', function () {
                        if($module){
                            removeAll();
                            if(element)
                                element.removeClass('show');
                            if(body)
                                body.css({ overflow: overflows.x, 'overflow-y': overflows.y });
                            flashes = [];
                        }
                    });

                    scope.add = add;
                    scope.remove = remove;
                    scope.removeAll = removeAll;
                    scope.flashes = flashes;
                    scope.leave = leave;
                    scope.enter = enter;

                    // don't wait for template
                    // just bind and return.
                    return $module;
                }    

                return bind();
            }

            // $flash requires singleton
            function getInstance() {
                if(!$module)
                    $module = new ModuleFactory();
                return $module;
            }

            // return $module instance.
            return getInstance();

        }];

        // return getter/setter.
        return {
            $set: set,
            $get: get
        };

    })

    .directive('aiFlash', [ '$flash', function ($flash) {

        return {
            restrict: 'EAC',
            scope: true,
            link: function (scope, element, attrs) {

                var $module, defaults, options;

                defaults = {
                    scope: scope
                };

                // initialize the directive.
                function init () {
                    $module = $flash.init(element, options);
                }

                options = scope.$eval(attrs.options) || scope.$eval(attrs.aiFlash);
                options = angular.extend(defaults, options);

                init();

            }
        };
    }]);


angular.module('ai.flash.interceptor', [])
    .factory('$flashInterceptor', ['$q', '$injector', function ($q, $injector) {
        return {
            responseError: function(res) {
                // get passport here to prevent circ dependency.
                var flash = $injector.get('$flash'),
                    excludeErrors = flash.options.excludeErrors || [];
                function handleFlashError(errObj){
                    var name, message, stack;
                    if(flash.options.errorKey)
                    errObj = errObj[flash.options.errorKey];
                    name = errObj.name || flash.options.errorName;
                    message = errObj.message || flash.options.errorMessage;
                    stack = errObj.stack || '';
                    if(stack && flash.options.stack){
                        if(angular.isArray(stack))
                            stack = stack.join('<br/>');
                        if(angular.isString(stack) && /\\n/g.test(stack))
                            stack = stack.split('\n').join('<br/>');
                        message += ('<br/><strong>Stack Trace:</strong><br/>' +  stack);
                    }
                    message = '<strong>Message:</strong> ' + message;
                    message = message.replace(/From previous event:/ig, '<strong>From previous event:</strong>');
                    flash.add(message, flash.options.typeError, name);
                }
                if(res.status && excludeErrors.indexOf(res.status) === -1){
                    // handle error using flash.
                    if(!res.data){
                        flash.add(res.statusText, flash.options.typeError || 'flash-danger', res.status);
                    } else {
                        var err = res.data,
                            handle;
                        if(flash.options.onError){
                            handle = flash.options.onError.call(this, res);
                            if(handle === true)
                                handleFlashError(err);
                            if(angular.isObject(handle))
                                handleFlashError(handle);
                        } else {
                            handleFlashError(err);
                        }
                    }
                }
                return $q.reject(res);
            }
        };
    }])
    .config(['$httpProvider', function ($httpProvider) {
        $httpProvider.interceptors.push('$flashInterceptor');
    }]);

// imports above modules.
angular.module('ai.flash', [
    'ai.flash.factory',
    'ai.flash.interceptor'
]);