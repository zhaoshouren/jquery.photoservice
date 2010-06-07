/*!
 * Photo Service jQuery Plugin v1.0.RC1
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
    nomen: true, // 1 expected dangling '_' in '_content' since this property that is sometimes returned in the JSON by flickr
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
            service: { // service (i.e. flickr & Picasa) specific settings
                //*required
                //name: name of service
                //method: non-authenticated flickr API method|Picasa feed types: user, album, photo, community, featured (contacts doesn't return photos so has been excluded)

                /* Picasa */
                //*required depending on method
                //userID:
                //albumID:
                //photoID:
                    parameters: {
                    /* flickr */
                    //*required
                    //api_key: apply for an flickr API key at http://www.flickr.com/services/api/keys/apply/

                    //*required depending on method
                    //photoset_id: http://www.flickr.com/photos/user_id/sets/photoset_id/

                    //*optional
                    //per_page: number of results to return by page, since this plugin doesn't support paging, use as max number of photos to retrieve
                    //extras: additional properties to add to JSON

                    // defaults
                    extras: "owner_name,original_format,o_dims",

                    /* Picasa */
                    //*optional
                    //access:
                    //alt:
                    //bbox:
                    //fields:
                    //imgmax:
                    //kind:
                    //l:
                    //max-results:
                    //prettyprint:
                    //q:
                    //start-index:
                    //tag:
                    //thumbsize:

                    // defaults
                    imgmax: 1600, // Picasa currently limits image size for remote linking check with Picasa API for current limit
                    thumbsize: '64c' // add a default "square" thumbmail for Picasa
                }
            },

            // settings that are not meant to be overridden, used for maintaining state by plugin
            currentIndex: undefined, // current index in the photos[] collection stored in cache[]
            indexes: [], // sorted indexes for photos[]; either random or ordered
            randomized: false // whether indexes[] has been randomized or not
        },
        key = 'photoService:configuration', // key for use with jQuery.data(key) to store configuration by jQuery object to which plugin has been called upon
        name = 'jQuery.photoService', // plugin name used for custom Error() thrown due error able to be caught in ajax calls
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

        photo.attribution = "";

        return photo;
    }
    Photo.prototype.updateAttribution = function () { //format title, if title is blank or undefined display [untitled], include author if available, and finally include site photo originates from
        var photo = this;

        photo.attribution = (photo.title !== "[untitled]" ? (photo.title.match(/"/g) ? photo.title : "\"" + photo.title + "\"") : photo.title) + (photo.author.length ? " by " + photo.author : "") + " (" + photo.site + ")";
    };

    function FlickrPhoto() {
        this.site = "www.flickr.com";
    }
    FlickrPhoto.prototype = new Photo();
    FlickrPhoto.prototype.map = function (json) {
        var photo = this,
            height = json.height_o || json.o_height,
            width = json.width_o || json.o_width,
            originalsecret = json.originalsecret,
            secret = json.secret,
            title = json.title,
            owner = json.owner,
            id = json.id,
            base,
            original,
            size,
            sizeMap = {
                Square: 'thumbnail',
                Thumbnail: 'tiny',
                Small: 'small',
                Medium: 'medium',
                Large: 'large',
                Original: 'original'
            };

            photo.index = json.index;
            photo.total = json.total;

            if (json.size === undefined) {
                base = "http://farm" + json.farm + ".static.flickr.com/" + json.server + "/" + id + "_";

                original = originalsecret ? (base + originalsecret + "_o." + json.originalformat + "") : json.o_url;

                base += secret;

                photo.large = (height <= 1200 && width <= 1200) ? original : (base + ((height > 500 || width > 500) ? "_b" : "") + ".jpg");
                photo.original = original || photo.large;
                photo.thumbnail = base + "_s.jpg";
                photo.tiny = base + "_t.jpg";
                photo.small = base + "_m.jpg";
                photo.medium = base + ".jpg";
            }
            else {
                for (size in json.size) {
                    photo[sizeMap[size.label]] = size.source;
                }

                if (!photo.original.length) {
                    photo.original = photo.large.length ? photo.large : photo.medium;
                }
            }
            photo.title = (typeof(title) === 'string' ? title : title._content) || "[untitled]";
            photo.link = "http://www.flickr.com/photos/" + (typeof(owner) === 'string' ? owner : owner.nsid) + "/" + id + "/";
            photo.author = json.ownername || owner.username;
            photo.id = id;

            photo.updateAttribution();

            return photo;
    }

    function PicasaPhoto() {
        this.site = "picasaweb.google.com";
    }
    PicasaPhoto.prototype = new Photo();
    PicasaPhoto.prototype.map = function (json) {
        var photo = this;

        photo.index = json.index;
        photo.total = json.total;
        photo.title = json.title.$t;
        photo.link = json.link[2].href;
        photo.original = json.content.src;
        photo.thumbnail = json.media$group.media$thumbnail[0].url;
        photo.author = json.feedAuthor || json.author[0].name.$t;

        photo.updateAttribution();

        return photo;
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
            var method = configuration_service.method,
                parameters = configuration_service.parameters,
                userID = configuration_service.userID,
                albumID = configuration_service.albumID;

            switch (configuration_service.name) {
            case 'flickr':
                if (!filters[method]) {
                    throwError("Could not find corresponding filter for method = '" + method + "'; if method is correct than it is not yet supported.");
                }
                url = "http://api.flickr.com/services/rest/?format=json&jsoncallback=?&" + jQuery.param(filterParameters(jQuery.extend({}, parameters, {method: method}), filters[method].concat(['method', 'api_key'])));
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
                    url += user + userID + album + albumID + "/photoid/" + configuration_service.photoID;
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

    function appendPhotos($this, photos, configuration) {
        var currentIndex = configuration.currentIndex,
            indexes = configuration.indexes,
            index,
            counter,
            limit,
            total = photos.length,
            className = configuration.className,
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
            currentIndex += configuration.increment;
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

        for (index = currentIndex, counter = 0, limit = configuration.limit || total; index < total && counter < limit; index += 1, counter += 1) {
            photo = photos[indexes[index]];

            $html = jQuery('<img>', {
                'class': className,
                src: photo[configuration.size] || photo.original,
                alt: photo.attribution
            });

            if (configuration.link) {
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

    function process($this, photos, configuration) {
        var successHandler = configuration.success;

        if (configuration.limit !== 0) {
            appendPhotos($this, photos, configuration);
        }

        if (typeof(successHandler) === 'function') {
            successHandler.call($this);
        }
    }

    function mapPhotos(dataJSON, configuration_service) {
        var photos = [],
            total = 0,
            author;

        if (configuration_service === 'picasa') {
            author = dataJSON.feed.gphoto$user !== undefined ? dataJSON.feed.author[0].name.$t : undefined;
            total = dataJSON.feed.entry.length;
            jQuery.each(dataJSON.feed.entry, function (index, photo) {
                photos[index] = new PicasaPhoto().map(jQuery.extend({index: index + 1, total: total, feedAuthor: author}, photo));
            });
        }
        else if (configuration_service === 'flickr') {
            if (dataJSON.photos !== undefined) {
                total = dataJSON.photos.photo.length;
                jQuery.each(dataJSON.photos.photo, function (index, photo) {
                    photos[index] = new FlickrPhoto().map(jQuery.extend({index: index + 1, total: total}, photo));
                });
            }
            else if (dataJSON.photoset !== undefined) {
                total = dataJSON.photoset.photo.length;
                jQuery.each(dataJSON.photoset.photo, function (index, photo) {
                    photos[index] = new FlickrPhoto().map(jQuery.extend({index: index + 1, total: total, owner: dataJSON.photoset.owner}, photo));
                });
            }
        }

        return photos;
    }

    function throwError(message) {
        throw jQuery.extend(new Error(), {
            name: name,
            message: message
        });
    }

    jQuery.fn.photoService = function (new_configuration) {
        var $this = this,
            configuration = jQuery.extend(true, {}, defaults, $this.data(key), new_configuration),
            errorHandler = configuration.error,
            url;

        $this.data(key, configuration);

        try {
            url = getJsonURL(configuration.service);

            return $this.each(function () {
                if (cache[url] === undefined) {
                    jQuery.getJSON(url, function (dataJSON) {
                        var service_name = configuration.service.name;

                        if (dataJSON && (service_name === 'picasa' || (service_name === 'flickr' && dataJSON.stat === 'ok'))) {
                            if (configuration.method === 'flickr.photos.getInfo') {
                                jQuery.getJSON(getJsonURL(jQuery.extend(true, {}, configuration.service, {method: 'flickr.photos.getSizes'})),
                                function (sizes) {
                                    if (sizes.stat === 'ok') {
                                        cache[url] = [mapPhoto(jQuery.extend({index: 1, total: 1}, dataJSON.photo, sizes.sizes), service_name)];
                                        process($this, cache[url], configuration);
                                    }
                                    else {
                                        throwError("failed to retrieve JSON for service = 'flicker' and method = 'flickr.photos.getSizes' because Flickr returned message: " + dataJSON.message);
                                    }
                                });
                            }
                            else {
                                cache[url] = mapPhotos(dataJSON, service_name);
                                process($this, cache[url], configuration);
                            }
                        }
                        else {
                            throwError("failed to retrieve JSON for service = '" + service_name + "' and method = '" + configuration.service.method + "'" + (dataJSON ? " because Flickr returned message: " + dataJSON.message : ", no message received"));
                        }
                    });
                }
                else {
                    process($this, cache[url], configuration);
                }
            });
        }
        catch (error) {
            if (typeof(errorHandler) === 'function') {
                errorHandler.call($this, error)
            }
        }
    };

    jQuery.extend({
        photoService: {
            getConfiguration: function (jQueryObject) {
                return (jQueryObject && jQueryObject.data) ? jQueryObject.data(key) : defaults;
            },
            defaults: function (new_defaults) {
                return jQuery.extend(true, defaults, new_defaults);
            },
            getPhotos: function (jQueryObject) {
                return (!jQueryObject || !jQueryObject.data) ? [] : cache[getJsonURL(jQueryObject.data(key).service)] || [];
            },
            getPhoto: function (jQueryObject) {
                var photos = this.getPhotos(jQueryObject),
                    configuration = this.getConfiguration(jQueryObject);

                return photos.length ? photos[configuration.indexes[configuration.currentIndex] || 0] : new Photo();
            }
        }
    });
}(jQuery));



