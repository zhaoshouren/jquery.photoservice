/*!
 * Photo Service jQuery Plugin v1.0.b
 * http://zhaoshouren.com/
 *
 * Copyright 2010, Warren Chu
 * licensed under the MIT license
 *
 * requires:
 *  jQuery JavaScript Library
 *  http://jquery.com/
 * compatible with:
 *  v1.4.2
 */

/* JSLint – The JavaScript Code Quality Tool
 * http://www.jslint.com/
 *
 * settings below
 */
/*global jQuery*/
/*jslint
    white: true,
    browser: true,
    onevar: true,
    undef: true,
    nomen: true,
    eqeqeq: true,
    plusplus: true,
    bitwise: true,
    regexp: true,
    newcap: true,
    immed: true,
    strict: true
 */

"use strict"; // ES5 strict mode

jQuery(function ($) {
    var defaults = {
            empty: true, // empty contents of target container before appending image(s)
            limit: undefined, // maximum number of images to append; leave undefined to append all
            start: 0, // starting index, set to 'random' for random starting index
            increment: 1, //default increment
            link: false, // wrap image with link to source
            className: 'photo',
            random: false, // randomize sort order of retrieved images stored in indexes

            size: 'thumbnail', // original|thumbnail|tiny|small|medium||large|

            service: {
                parameters: {
                    // Picasa defaults
                    imgmax: 1600, // Picasa currently limits image size for remote linking check with Picasa API for current limit
                    thumbsize: '64c' // add a default "square" thumbmail for Picasa
                }
            }
        },
        key = 'ps:config',
        name = 'jquery.photo-service',
        errorTemplate = 'failed to retrieve JSON for service=%1 & method=%2 because %3',
        cache = [],
        getJsonURL;

    function Photo() {
        var photo = this;

        photo.title = "";
        photo.link = "";
        photo.original = "";
        photo.thumbnail = "";
        photo.tiny = "";
        photo.small = "";
        photo.medium = "";
        photo.large = "";
        photo.author = "";
        photo.site = "";
        photo.license = "";
        photo.index = "";
        photo.id = "";

        return photo;
    }

    Photo.prototype.linkText = function () {
        var photo = this;

        return (photo.title !== "[untitled]" ? (photo.title.match(/"/g) ? photo.title : "\"" + photo.title + "\"") : photo.title) + (photo.author.length ? " by " + photo.author : "") + " (" + photo.site + ")";
    };

    function filterParameters($parameters, $filters) {
        var parameters = {},
            i,
            filter,
            parameter;

        for (i = 0; i < $filters.length; i += 1) {
            filter = $filters[i];
            parameter = $parameters[filter];
            if (parameter) {
                parameters[filter] = parameter;
            }
        }

        return parameters;
    }

    getJsonURL = (function () { // create a closure so that filters, user, albumid will not have to be created with each call to getJsonURL
        var url = '',
            filters = {
                'flickr.favorites.getPublicList': ['user_id', 'min_fave_date', 'max_fave_date', 'extras', 'per_page', 'page'],
                'flickr.groups.pools.getPhotos': ['group_id', 'tags', 'user_id', 'extras', 'per_page', 'page'],
                'flickr.interestingness.getList': ['date', 'extras', 'per_page', 'page'],
                'flickr.people.getPublicPhotos': ['user_id', 'safe_search', 'extras', 'per_page', 'page'],
                'flickr.photos.getInfo': ['photo_id', 'secret'],
                'flickr.photosets.getPhotos': ['photoset_id', 'extras', 'privacy_filter', 'per_page', 'page', 'media'],
                'flickr.photos.getRecent': ['extras', 'per_page', 'page'],
                'flickr.photos.search': ['user_id', 'tags', 'tag_mode', 'text', 'min_upload_date', 'max_upload_date',
                    'min_taken_date', 'max_taken_date', 'license', 'sort', 'privacy_filter', 'bbox', 'accuracy', 'save_search',
                    'content_type', 'machine_tag_mode', 'group_id', 'contacts', 'woe_id', 'place_id', 'media', 'has_geo', 'geo_context',
                    'lat', 'lon', 'radius', 'radius_unites', 'is_commons', 'extras', 'per_page', 'page'],
                'flickr.photos.getSizes': ['photo_id'],
                picasa: ['access', 'alt', 'bbox', 'fields', 'imgmax', 'kind', 'l', 'max-results', 'prettyprint', 'q', 'start-index', 'tag', 'thumbsize']
            },
            user = "user/",
            album = "/albumid/";

        return function ($service) {
            var service = $service,
                method = service.method,
                parameters = service.parameters,
                userID = service.userID,
                albumID = service.albumID;

            switch (service.name) {
            case 'flickr':
                url = "http://api.flickr.com/services/rest/?format=json&jsoncallback=?&" + $.param(filterParameters($.extend({}, parameters, {method: method}), (filters[method] || []).concat(['method', 'api_key'])));
                break;
            case 'picasa':
                url = "http://picasaweb.google.com/data/feed/api/";

                switch (method) {
                case 'user':
                    url += user + userID;
                    break;
                case 'album':
                    url += user + userID + album + albumID;
                    break;
                case 'photo':
                    url += user + userID + album + albumID + "/photoid/" + service.photoID;
                    break;
                case 'community':
                    url += "all";
                    break;
                case 'featured':
                    url += "featured";
                    break;
                default:
                }
                url += "?alt=json&callback=?&kind=photo&" + $.param(filterParameters(parameters, filters.picasa));
                break;
            default:
            }

            return url;
        };
    }());

    function appendPhotos($photos, $config, $this) {
        var index = $config.index,
            indexes = $config.indexes,
            increment = $config.increment,
            i,
            counter,
            total = $photos.length,
            limit = $config.limit || total, //test when limit set to -1
            className = $config.className,
            size = $config.size,
            link = $config.link,
            start = $config.start,
            photo,
            html;

        if (!isNaN(index) && $config.random !== $config.randomized && $config.randomized) {
            index = indexes[index];
        }

        if (isNaN(index)) {
            index = start === 'random' ? Math.floor(Math.random() * total) : start;
            indexes = [];
        }
        else {
            index = index + (isNaN(increment) ? 1 : increment);
        }

        if (!indexes.length || ($config.random !== $config.randomized)) {
            for (i = 0; i < total; i += 1) {
                indexes[i] = i;
            }
            if ($config.random) {
                indexes.sort(function () {
                    return 0.5 - Math.random();
                });
                $config.randomized = true;
            }
        }

        if (index >= total) {
            index = 0;
        }
        else if (index < 0) {
            index = total - 1;
        }

        if ($config.empty) {
            $this.empty();
        }

        for (i = index, counter = 0; i < total && counter < limit; i += 1, counter += 1) {
            photo = $photos[indexes[i]];

            html = $('<img>', {
                'class': className,
                src: photo[size] || photo.original,
                alt: photo.title
            });

            if (link) {
                html = $('<a>', {
                    href: photo.link,
                    title: photo.linkText(),
                    'class': className
                }).append(html);
            }

            if ($this.is("ul")) {
                html = $('<li>', {
                    'class': className
                }).append(html);
            }

            $this.append(html);
        }

        $config.index = index;
        $config.indexes = indexes;
        $this.data(key, $config);
    }

    function execute($photos, $config, $this) {
        var successHandler = $config.success;

        if ($config.limit !== 0) {
            appendPhotos($photos, $config, $this);
        }

        if (typeof(successHandler) === 'function') {
            successHandler($this);
        }
    }

    function mapPhoto($photoJSON, $service) {
        var photo = new Photo(),
            base,
            original,
            large;

        photo.index = $photoJSON.index;
        photo.total = $photoJSON.total;

        if ($service === 'picasa') {
            photo.title = $photoJSON.title.$t;
            photo.link = $photoJSON.link[2].href;
            photo.original = $photoJSON.content.src;
            photo.thumbnail = $photoJSON.media$group.media$thumbnail[0].url;
            photo.tiny = "";
            photo.small = "";
            photo.medium = "";
            photo.large = "";
            photo.author = $photoJSON.feedAuthor || $photoJSON.author[0].name.$t;
            photo.site = "picasaweb.google.com";
        }
        else if ($service === 'flickr') {
            if ($photoJSON.size === undefined) {
                base = "http://farm" + $photoJSON.farm + ".static.flickr.com/" + $photoJSON.server + "/" + $photoJSON.id + "_";
                original = $photoJSON.originalsecret !== undefined ? base + $photoJSON.originalsecret + "_o." + $photoJSON.originalformat + "" : $photoJSON.o_url;
                large = ($photoJSON.height_o <= 1200 && $photoJSON.width_o <= 1200) || ($photoJSON.o_height <= 1200 && $photoJSON.o_width <= 1200) ? original : (base + $photoJSON.secret + (($photoJSON.height_o > 500 || $photoJSON.width_o > 500) || ($photoJSON.o_height > 500 || $photoJSON.o_width > 500) ? "_b" : "") + ".jpg");

                base += $photoJSON.secret;

                photo.original = original || large;
                photo.thumbnail = base + "_s.jpg";
                photo.tiny = base + "_t.jpg";
                photo.small = base + "_m.jpg";
                photo.medium = base + ".jpg";
                photo.large = large;
            }
            else {
                $.each($photoJSON.size, function (i, size) {
                    switch (size.label) {
                    case 'Square':
                        photo.thumbnail = size.source;
                        break;
                    case 'Thumbnail':
                        photo.tiny = size.source;
                        break;
                    case 'Small':
                        photo.small = size.source;
                        break;
                    case 'Medium':
                        photo.medium = size.source;
                        break;
                    case 'Large':
                        photo.large = size.source;
                        break;
                    case 'Original':
                        photo.original = size.source;
                        break;
                    default:
                    }
                });
                if (!photo.original.length) {
                    photo.original = photo.large.length ? photo.large : photo.medium;
                }
                if (!photo.large.length) {
                    photo.large = photo.original;
                }
            }
            photo.title = typeof($photoJSON.title) === 'string' ? $photoJSON.title : $photoJSON.title._content;
            if (!photo.title.length) {
                photo.title = "[untitled]";
            }
            photo.link = "http://www.flickr.com/photos/" + (typeof($photoJSON.owner) === 'string' ? $photoJSON.owner : $photoJSON.owner.nsid) + "/" + $photoJSON.id + "/";
            photo.author = $photoJSON.ownername || $photoJSON.owner.username;
            photo.site = "www.flickr.com";
            photo.id = $photoJSON.id;

        }
        return photo;
    }

    function mapPhotos($photoJSON, $service) {
        var photos = [],
            total = 0,
            author;

        if ($service === 'picasa') {
            author = $photoJSON.feed.gphoto$user !== undefined ? $photoJSON.feed.author[0].name.$t : undefined;
            $.each($photoJSON.feed.entry, function (i, photo) {
                photos[i] = mapPhoto($.extend({index: i + 1, total: total, feedAuthor: author}, photo), $service);
            });
        }
        else if ($service === 'flickr') {
            if ($photoJSON.photos !== undefined) {
                total = $photoJSON.photos.photo.length;
                $.each($photoJSON.photos.photo, function (i, photo) {
                    photos[i] = mapPhoto($.extend({index: i + 1, total: total}, photo), $service);
                });
            }
            else if ($photoJSON.photoset !== undefined) {
                total = $photoJSON.photoset.photo.length;
                $.each($photoJSON.photoset.photo, function (i, photo) {
                    photos[i] = mapPhoto($.extend({index: i + 1, total: total, owner: $photoJSON.photoset.owner}, photo), $service);
                });
            }
        }

        return photos;
    }

    $.fn.extend({
        photoService: function ($config) {
            var $this = $(this);

            return this.each(function () {
                var $that = $this,
                    config = $.extend(true, {}, defaults, $that.data(key), $config),
                    url = getJsonURL(config.service);

                $that.data(key, config);

                return function () {
                    var errorHandler = $config.error;

                    if (cache[url] === undefined) {
                        $.getJSON(url, function (json) {
                            var service = config.service.name;

                            try {
                                if (json && (service === 'picasa' || (service === 'flickr' && json.stat === 'ok'))) {
                                    if (config.method === 'flickr.photos.getInfo') {
                                        $.getJSON(getJsonURL($.extend(true, {}, config.service, {method: 'flickr.photos.getSizes'})),
                                        function (sizes) {
                                            if (sizes.stat === 'ok') {
                                                cache[url] = [mapPhoto($.extend({index: 1, total: 1}, json.photo, sizes.sizes), service)];
                                                execute(cache[url], config, $that);
                                            }
                                            else {
                                                throw $.extend(new Error(), {
                                                    name: name,
                                                    message: "failed to retrieve JSON for service=flicker & method=flickr.photos.getSizes because Flickr returned message: " + json.message
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        cache[url] = mapPhotos(json, service);
                                        execute(cache[url], config, $that);
                                    }
                                }
                                else {
                                    throw $.extend(new Error(), {
                                        name: name,
                                        message: "failed to retrieve JSON for service=" + service + " and method=" + config.service.method + (json ? " because Flickr returned message: " + json.message : ", no message received")
                                    });
                                }
                            }
                            catch (error) {
                                if (typeof(errorHandler) === 'function') {
                                    errorHandler($that, error);
                                }
                            }
                        });
                    }
                    else {
                        execute(cache[url], config, $that);
                    }
                };
            }());
        }
    });

    $.extend({
        photoService: {
            getPhoto: (function () {
                var data = {
                        index: undefined,
                        indexes: [],
                        randomized: false
                    };

                return function (jQueryElement) {
                    var photos = this.getPhotos(jQueryElement),
                        config = jQueryElement === undefined || jQueryElement.data === undefined ?  data : $.extend(true, {}, data, jQueryElement.data(key));

                    return photos.length ? photos[config.indexes[config.index] || 0] : new Photo();
                };
            }()),

            getPhotos: function (jQueryElement) {
                if (jQueryElement === undefined || jQueryElement.data === undefined) {
                    return [];
                }
                return cache[getJsonURL(jQueryElement.data(key).service)] || [];
            },

            defaults: function (config) {
                $.extend(true, defaults, config);

                return defaults;
            },

            config: function (jQueryElement) {
                return jQueryElement.data(key);
            }
        }
    });
});



