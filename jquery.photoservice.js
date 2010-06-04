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

(function (jQuery) {
    var defaults = {
            empty: true, // empty contents of target container before appending image(s)
            limit: undefined, // maximum number of images to append; leave undefined to append all
            start: 0, // starting index, set to 'random' for random starting index
            increment: 1, //default increment for traversing retrieved images, set to -1 to traverse in reverse order
            link: false, // wrap image with link to image page at service (ie. flickr, Picasa)
            className: 'photo', //CSS class name used for <img> and <a>,<li> when generated
            random: false, // randomize sort order of retrieved images stored in indexes

            size: 'thumbnail', // original|thumbnail(square)|tiny(thumbnail at original aspect)|small|medium|large (avaiable sizes vary between services, selecting size that doesn't exist for particular image will default to original)

            service: {
                parameters: {
                    //name: name of service
                    //method: non-authenticated flickr API method|Picasa feed types: user, album, photo, community, featured (contacts doesn't return photos so has been excluded)

                    // Picasa defaults
                    imgmax: 1600, // Picasa currently limits image size for remote linking check with Picasa API for current limit
                    thumbsize: '64c' // add a default "square" thumbmail for Picasa
                }
            },

            // settings that are not meant to be overridden, used for maintaining state
            currentIndex: undefined,
            indexes: [],
            randomized: false
        },
        key = 'ps:config', // key for use with jQuery.data(key) to store configuration by jQuery object to which plugin has been called upon
        name = 'jquery.photoservice',
        cache = [], // store photo collections by URL so they can be shared by all calls of plugin on page
        getJsonURL; // function that will be declared with a closure, hence allocating the name in this var statement

    function Photo() { //plugin's photo object to which services JSON photo information is mapped to
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

    Photo.prototype.formatTitle = function () { //format title, if title is blank or undefined display [untitled], include author if available, and finally include site photo originates from
        var photo = this;

        return (photo.title !== "[untitled]" ? (photo.title.match(/"/g) ? photo.title : "\"" + photo.title + "\"") : photo.title) + (photo.author.length ? " by " + photo.author : "") + " (" + photo.site + ")";
    };

    function filterParameters(parameters, filters) {
        var filteredParmeters = {},
            index, total,
            filter,
            parameter;

        for (index = 0, total = filters.length; index < total; index += 1) {
            filter = filters[index];
            parameter = parameters[filter];
            if (parameter) {
                filteredParmeters[filter] = parameter;
            }
        }

        return filteredParmeters;
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

        return function (configuration_service) {
            var service = configuration_service,
                method = service.method,
                parameters = service.parameters,
                userID = service.userID,
                albumID = service.albumID;

            switch (service.name) {
            case 'flickr':
                url = "http://api.flickr.com/services/rest/?format=json&jsoncallback=?&" + jQuery.param(filterParameters(jQuery.extend({}, parameters, {method: method}), (filters[method] || []).concat(['method', 'api_key'])));
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
                url += "?alt=json&callback=?&kind=photo&" + jQuery.param(filterParameters(parameters, filters.picasa));
                break;
            default:
            }

            return url;
        };
    }());

    function appendPhotos(photos, configuration, $this) {
        var currentIndex = configuration.currentIndex,
            indexes = configuration.indexes,
            increment = configuration.increment,
            index,
            counter,
            total = photos.length,
            limit = configuration.limit || total,
            className = configuration.className,
            size = configuration.size,
            link = configuration.link,
            start = configuration.start,
            random = configuration.random,
            randomized = configuration.randomized,
            photo,
            $html = jQuery();

        if (!isNaN(currentIndex) && random !== randomized && randomized) {
            currentIndex = indexes[currentIndex];
        }

        if (isNaN(currentIndex)) {
            currentIndex = start === 'random' ? Math.floor(Math.random() * total) : start;
            indexes = [];
        }
        else {
            currentIndex += increment;
        }

        if (!indexes.length || random !== randomized) {
            for (index = 0; index < total; index += 1) {
                indexes[index] = index;
            }
            if (random) {
                indexes.sort(function () {
                    return 0.5 - Math.random();
                });
                randomized = true;
            }
        }

        if (currentIndex >= total) {
            currentIndex = 0;
        }
        else if (currentIndex < 0) {
            currentIndex = total - 1;
        }

        if (configuration.empty) {
            $this.empty();
        }

        for (index = currentIndex, counter = 0; index < total && counter < limit; index += 1, counter += 1) {
            photo = photos[indexes[index]];

            $html = jQuery('<img>', {
                'class': className,
                src: photo[size] || photo.original,
                alt: photo.formatTitle()
            });

            if (link) {
                $html = jQuery('<a>', {
                    href: photo.link,
                    'class': className
                }).append($html);
            }

            if ($this.is("ul")) {
                $html = jQuery('<li>', {
                    'class': className
                }).append($html);
            }

            $this.append($html);
        }

        configuration.currentIndex = currentIndex;
        configuration.indexes = indexes;
        $this.data(key, configuration);
    }

    function execute(photos, configuration, $this) {
        var successHandler = configuration.success;

        if (configuration.limit !== 0) {
            appendPhotos(photos, configuration, $this);
        }

        if (typeof(successHandler) === 'function') {
            successHandler.call($this);
        }
    }

    function mapPhoto(dataJSON, configuration_service) {
        var photo = new Photo(),
            height = dataJSON.height_o || dataJSON.o_height,
            width = dataJSON.width_o || dataJSON.o_width,
            originalsecret = dataJSON.originalsecret,
            secret = dataJSON.secret,
            title = dataJSON.title,
            base,
            original,
            large;

        photo.index = dataJSON.index;
        photo.total = dataJSON.total;

        if (configuration_service === 'picasa') {
            photo.title = dataJSON.title.$t;
            photo.link = dataJSON.link[2].href;
            photo.original = dataJSON.content.src;
            photo.thumbnail = dataJSON.media$group.media$thumbnail[0].url;
            photo.author = dataJSON.feedAuthor || dataJSON.author[0].name.$t;
            photo.site = "picasaweb.google.com";
        }
        else if (configuration_service === 'flickr') {
            if (dataJSON.size === undefined) {
                base = "http://farm" + dataJSON.farm + ".static.flickr.com/" + dataJSON.server + "/" + dataJSON.id + "_";
                original = (originalsecret !== undefined) ? base + originalsecret + "_o." + dataJSON.originalformat + "" : dataJSON.o_url;
                large = (height <= 1200 && width <= 1200) ? original : (base + secret + (height > 500 || width > 500 ? "_b" : "") + ".jpg");

                base += secret;

                photo.original = original || large;
                photo.thumbnail = base + "_s.jpg";
                photo.tiny = base + "_t.jpg";
                photo.small = base + "_m.jpg";
                photo.medium = base + ".jpg";
                photo.large = large;
            }
            else {
                jQuery.each(dataJSON.size, function (index, size) {
                    var source = size.source;
                    switch (size.label) {
                    case 'Square':
                        photo.thumbnail = source;
                        break;
                    case 'Thumbnail':
                        photo.tiny = source;
                        break;
                    case 'Small':
                        photo.small = source;
                        break;
                    case 'Medium':
                        photo.medium = source;
                        break;
                    case 'Large':
                        photo.large = source;
                        break;
                    case 'Original':
                        photo.original = source;
                        break;
                    default:
                    }
                });

                if (!photo.original.length) {
                    photo.original = photo.large.length ? photo.large : photo.medium;
                }
            }
            photo.title = (typeof(title) === 'string' ? title : title._content) || "[untitled]";
            photo.link = "http://www.flickr.com/photos/" + (typeof(dataJSON.owner) === 'string' ? dataJSON.owner : dataJSON.owner.nsid) + "/" + dataJSON.id + "/";
            photo.author = dataJSON.ownername || dataJSON.owner.username;
            photo.site = "www.flickr.com";
            photo.id = dataJSON.id;
        }
        return photo;
    }

    function mapPhotos(dataJSON, configuration_service) {
        var photos = [],
            total = 0,
            author;

        if (configuration_service === 'picasa') {
            author = dataJSON.feed.gphoto$user !== undefined ? dataJSON.feed.author[0].name.$t : undefined;
            total = dataJSON.feed.entry.length;
            jQuery.each(dataJSON.feed.entry, function (index, photo) {
                photos[index] = mapPhoto(jQuery.extend({index: index + 1, total: total, feedAuthor: author}, photo), configuration_service);
            });
        }
        else if (configuration_service === 'flickr') {
            if (dataJSON.photos !== undefined) {
                total = dataJSON.photos.photo.length;
                jQuery.each(dataJSON.photos.photo, function (index, photo) {
                    photos[index] = mapPhoto(jQuery.extend({index: index + 1, total: total}, photo), configuration_service);
                });
            }
            else if (dataJSON.photoset !== undefined) {
                total = dataJSON.photoset.photo.length;
                jQuery.each(dataJSON.photoset.photo, function (index, photo) {
                    photos[index] = mapPhoto(jQuery.extend({index: index + 1, total: total, owner: dataJSON.photoset.owner}, photo), configuration_service);
                });
            }
        }

        return photos;
    }

    jQuery.fn.extend({
        photoService: function (new_configuration) {
            var $this = this;

            return this.each(function () {
                var $that = $this,
                    configuration = jQuery.extend(true, {}, defaults, $that.data(key), new_configuration),
                    url = getJsonURL(configuration.service);

                $that.data(key, configuration);

                return function () {
                    var errorHandler = configuration.error;

                    if (cache[url] === undefined) {
                        jQuery.getJSON(url, function (dataJSON) {
                                var service_name = configuration.service.name;

                                try {
                                        if (dataJSON && (service_name === 'picasa' || (service_name === 'flickr' && dataJSON.stat === 'ok'))) {
                                            if (configuration.method === 'flickr.photos.getInfo') {
                                                jQuery.getJSON(getJsonURL(jQuery.extend(true, {}, configuration.service, {method: 'flickr.photos.getSizes'})),
                                                function (sizes) {
                                                    if (sizes.stat === 'ok') {
                                                        cache[url] = [mapPhoto(jQuery.extend({index: 1, total: 1}, dataJSON.photo, sizes.sizes), service_name)];
                                                        execute(cache[url], configuration, $that);
                                                    }
                                                    else {
                                                    throw jQuery.extend(new Error(), {
                                                        name: name,
                                                        message: "failed to retrieve JSON for service=flicker & method=flickr.photos.getSizes because Flickr returned message: " + dataJSON.message
                                                    });
                                                    }
                                                });
                                            }
                                            else {
                                                cache[url] = mapPhotos(dataJSON, service_name);
                                                execute(cache[url], configuration, $that);
                                            }
                                        }
                                        else {
                                            throw jQuery.extend(new Error(), {
                                                name: name,
                                                message: "failed to retrieve JSON for service=" + service_name + " and method=" + configuration.service.method + (dataJSON ? " because Flickr returned message: " + dataJSON.message : ", no message received")
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
                        execute(cache[url], configuration, $that);
                    }
                };
            }());
        }
    });

    jQuery.extend({
        photoService: {
            configuration: function (jQueryObject) {
                return (jQueryObject && jQueryObject.data) ? jQueryObject.data(key) : defaults;
            },
            defaults: function (new_defaults) {
                return jQuery.extend(true, defaults, new_defaults);;
            },
            getPhotos: function (jQueryObject) {
                return (!jQueryObject || !jQueryObject.data)? [] : cache[getJsonURL(jQueryObject.data(key).service)] || [];
            },
            getPhoto: function (jQueryObject) {
                var photos = this.getPhotos(jQueryObject),
                    configuration = this.configuration(jQueryObject);

                return photos.length ? photos[configuration.indexes[configuration.currentIndex] || 0] : new Photo();
            }
        }
    });
}(jQuery));



