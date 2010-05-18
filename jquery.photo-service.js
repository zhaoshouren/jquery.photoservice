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
            start: 0, // starting index
            increment: 1, //default increment
            link: false, // wrap image with link to source
            className: 'photo',
            random: false, // randomize sort order of retrieved images stored in indexes

            size: 'thumbnail', // original|thumbnail|tiny|small|medium||large|

            //picasa defaults
            imgmax: 1600, // picasa currently limits image size to 800 pixels for remote linking as of 7/7/2009
            thumbsize: '64c' // add a default "square" thumbmail for picasa
        },
        data = {
            index: undefined,
            indexes: [],
            randomized: false
        },
        key = 'ps:config',
        cache = [],

        getProperties = (function () {
            return function (config, filters) {
                var properties = {},
                    i,
                    filter,
                    property;

                for (i = 0; i < filters.length; i += 1) {
                    filter = filters[i];
                    property = config[filter];
                    if (property) {
                        properties[filter] = property;
                    }
                }

                return properties;
            };
        }()),

        getJsonURL = (function () {
            var url,
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
                albumid = "/albumid/";

            return function (config) {
                switch (config.service) {
                case 'flickr':
                    url = "http://api.flickr.com/services/rest/?format=json&jsoncallback=?&" + $.param(getProperties(config, (filters[config.method] || []).concat(['method', 'api_key'])));
                    break;
                case 'picasa':
                    url = "http://picasaweb.google.com/data/feed/api/";

                    switch (config.method) {
                    case 'user':
                        url += user + config.userID;
                        break;
                    case 'album':
                        url += user + config.userID + albumid + config.albumID;
                        break;
                    case 'photo':
                        url += user + config.userID + albumid + config.albumID + "/photoid/" + config.photoID;
                        break;
                    case 'community':
                        url += "all";
                        break;
                    case 'featured':
                        url += "featured";
                        break;
                    default:
                    }
                    url += "?alt=json&callback=?&kind=photo&" + $.param(getProperties(config, filters.picasa));
                    break;
                default:
                    url = "";
                }
                return url;
            };
        }());

    function Photo() {
        return {
            title: "",
            link: "",
            original: "",
            thumbnail: "",
            tiny: "",
            small: "",
            medium: "",
            large: "",
            author: "",
            site: "",
            license: "",
            index: "",
            id: "",

            linkText: function () { // convert to getter when supported across browsers
                return (this.title !== "[untitled]" ? (this.title.match(/"/g) ? this.title : "\"" + this.title + "\"") : this.title) + (this.author.length ? " by " + this.author : "") + " (" + this.site + ")";
            }
        };
    }

    $.fn.extend({
        photoService: function ($config) {
            var $this = $(this);

            function appendPhotos(photos, config, that) {
                var index = config.index,
                    indexes = config.indexes,
                    increment = config.increment,
                    i,
                    counter,
                    total = photos.length,
                    limit = config.limit || total, //test when limit set to -1
                    className = config.className,
                    photo,
                    html;

                if (!isNaN(index) && config.random !== config.randomized && config.randomized) {
                    index = indexes[index];
                }

                if (isNaN(index)) {
                    index = config.start;
                    indexes = [];
                }
                else {
                    index = index + (isNaN(increment) ? 1 : increment);
                }

                if (!indexes.length || (config.random !== config.randomized)) {
                    for (i = 0; i < total; i += 1) {
                        indexes[i] = i;
                    }
                    if (config.random) {
                        indexes.sort(function () {
                            return 0.5 - Math.random();
                        });
                        config.randomized = true;
                    }
                }

                if (index >= total) {
                    index = 0;
                }
                else if (index < 0) {
                    index = total - 1;
                }

                if (config.empty) {
                    $this.empty();
                }

                for (i = index, counter = 0; i < total && counter < limit; i += 1, counter += 1) {
                    photo = photos[indexes[i]];

                    html = $('<img/>', {
                        'class': className,
                        src: photo[config.size] || photo.original,
                        alt: photo.title
                    });

                    if (config.link) {
                        html = $('<a/>', {
                            href: photo.link,
                            title: photo.linkText(),
                            'class': className
                        }).append(html);
                    }

                    if ($this.is("ul")) {
                        html = $('<li/>', {
                            'class': className
                        }).append(html);
                    }

                    $this.append(html);
                }

                config.index = index;
                config.indexes = indexes;
                that.data(key, config);
            }

            function execute(photos, config, that) {
                if (config.limit !== 0) {
                    appendPhotos(photos, config, that);
                }

                $.each(config, function (i, fn) {
                    if (typeof(fn) === 'function') {
                        fn();
                    }
                });
            }

            function mapPhoto(photoJSON, format) {
                var photo = new Photo(),
                    base,
                    original,
                    large;

                photo.index = photoJSON.index;
                photo.total = photoJSON.total;

                if (format === 'picasa') {
                    photo.title = photoJSON.title.$t;
                    photo.link = photoJSON.link[2].href;
                    photo.original = photoJSON.content.src;
                    photo.thumbnail = photoJSON.media$group.media$thumbnail[0].url;
                    photo.tiny = "";
                    photo.small = "";
                    photo.medium = "";
                    photo.large = "";
                    photo.author = photoJSON.feedAuthor || photoJSON.author[0].name.$t;
                    photo.site = "picasaweb.google.com";
                }
                else if (format === 'flickr') {
                    if (photoJSON.size === undefined) {
                        base = "http://farm" + photoJSON.farm + ".static.flickr.com/" + photoJSON.server + "/" + photoJSON.id + "_";
                        original = photoJSON.originalsecret !== undefined ? base + photoJSON.originalsecret + "_o." + photoJSON.originalformat + "" : photoJSON.o_url;
                        large = (photoJSON.height_o <= 1200 && photoJSON.width_o <= 1200) || (photoJSON.o_height <= 1200 && photoJSON.o_width <= 1200) ? original : (base + photoJSON.secret + ((photoJSON.height_o > 500 || photoJSON.width_o > 500) || (photoJSON.o_height > 500 || photoJSON.o_width > 500) ? "_b" : "") + ".jpg");

                        base += photoJSON.secret;

                        photo.original = original || large;
                        photo.thumbnail = base + "_s.jpg";
                        photo.tiny = base + "_t.jpg";
                        photo.small = base + "_m.jpg";
                        photo.medium = base + ".jpg";
                        photo.large = large;
                    }
                    else {
                        $.each(photoJSON.size, function (i, size) {
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
                    photo.title = typeof(photoJSON.title) === 'string' ? photoJSON.title : photoJSON.title._content;
                    if (!photo.title.length) {
                        photo.title = "[untitled]";
                    }
                    photo.link = "http://www.flickr.com/photos/" + (typeof(photoJSON.owner) === 'string' ? photoJSON.owner : photoJSON.owner.nsid) + "/" + photoJSON.id + "/";
                    photo.author = photoJSON.ownername || photoJSON.owner.username;
                    photo.site = "www.flickr.com";
                    photo.id = photoJSON.id;

                }
                return photo;
            }

            function mapPhotos(photosJSON, format) {
                var photos = [],
                    total = 0,
                    author;

                if (format === 'picasa') {
                    author = photosJSON.feed.gphoto$user !== undefined ? photosJSON.feed.author[0].name.$t : undefined;
                    $.each(photosJSON.feed.entry, function (i, photo) {
                        photos[i] = mapPhoto($.extend({index: i + 1, total: total, feedAuthor: author}, photo), format);
                    });
                }
                else if (format === 'flickr') {
                    if (photosJSON.photos !== undefined) {
                        total = photosJSON.photos.photo.length;
                        $.each(photosJSON.photos.photo, function (i, photo) {
                            photos[i] = mapPhoto($.extend({index: i + 1, total: total}, photo), format);
                        });
                    }
                    else if (photosJSON.photoset !== undefined) {
                        total = photosJSON.photoset.photo.length;
                        $.each(photosJSON.photoset.photo, function (i, photo) {
                            photos[i] = mapPhoto($.extend({index: i + 1, total: total, owner: photosJSON.photoset.owner}, photo), format);
                        });
                    }
                }

                return photos;
            }

            return this.each(function () {
                var $that = $this,
                    config = $.extend({}, defaults, $that.data(key), $config),
                    url = getJsonURL(config);

                $that.data(key, config);
                
                return function () {
                    if (cache[url] === undefined) {
                        $.getJSON(url, function (json) {
                            if ((config.service === 'picasa' && json) || (config.service === 'flickr' && json.stat === 'ok')) {
                                if (config.method === 'flickr.photos.getInfo') {
                                    $.getJSON(getJsonURL($.extend({}, config, {method: 'flickr.photos.getSizes'})),
                                    function (sizes) {
                                        if (sizes.stat === 'ok') {
                                            cache[url] = [mapPhoto($.extend({index: 1, total: 1}, json.photo, sizes.sizes), config.service)];
                                            execute(cache[url], config, $that);
                                        }
                                    });
                                }
                                else {
                                    cache[url] = mapPhotos(json, config.service);
                                    execute(cache[url], config, $that);
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
            getPhoto: function (jQueryElement) {
                var photos = this.getPhotos(jQueryElement),
                    config = jQueryElement === undefined || jQueryElement.data === undefined ?  data : $.extend({}, data, jQueryElement.data(key));

                return photos.length ? photos[config.indexes[config.index] || 0] : new Photo();
            },

            getPhotos: function (jQueryElement) {
                if (jQueryElement === undefined || jQueryElement.data === undefined) {
                    return [];
                }
                return cache[getJsonURL(jQueryElement.data(key))] || [];
            },

            defaults: function (config) {
                $.extend(defaults, config);

                return defaults;
            },

            config: function (jQueryElement) {
                return jQueryElement.data(key);
            }
        }
    });
});



