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
/*global window,ZS,jQuery*/
/*jslint
    white: true,
    browser: true,
    forin: true,
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

(function (window) { 
    var ZS = window.ZS || {}; //check if ZS has already been added to window (global), if not create an empty namespace (object)
    
    if (!window.ZS) { //not defined
        window.ZS = ZS; //add ZS to global(window) namespace
    }
    
    if (!ZS.inherit) { //not defined
        //based on a snippet from http://www.jspatterns.com/
        //which in turn is based on stuff found on the net
        ZS.inherit = function (Child, Parent) {
            var Temp = function () {};
            
            Temp.prototype = Parent.prototype;
            Child.prototype = new Temp();
            Child.uber = Parent.prototype;
            Child.prototype.constructor = Child;
        };
    }
    
    //Base/Abstract Functions ("classes") for sharing code between implementations
    function Photo() { //common Photo function in which photo data is mapped to
        return this;
        //properties implemented in Child Functions

        //this.attribution = ""; // see Photo.prototype.updateAttribution
        //this.author = "";
        //this.id = ""; // id of photo on photo service
        //this.index = ""; // index of photo in retrieved collection
        //this.license = ""; // photo's license type
        //this.link = ""; // URL to photo's page on photo service
        //this.title = "";
        //this.total = ""; // total number of photos in retrieved collection
        
        //photo sizes; depending on service and parameters supplied not all sizes will be available
        
        //this.original = "";
        //this.thumbnail = "";
        //this.tiny = "";
        //this.small = "";
        //this.medium = "";
        //this.large = "";
    }
    Photo.prototype.updateAttribution = function () { //format title, if title is blank or undefined display [untitled], include author if available, and finally include site photo originates from
        var photo = this;

        photo.attribution = (photo.title !== "[untitled]" ? (photo.title.match(/"/g) ? photo.title : "\"" + photo.title + "\"") : photo.title) + (photo.author ? " by " + photo.author : "") + " (" + photo.site + ")";
        
        return photo;
    };
    //to be implemented in Child Functions
    //Child.prototype.mapPhoto = function(dataToBeMapped) {...};
    //Child.prototype.site = "www.flickr.com for example";
    
    function Service() { //common service Function to retrieve and process photo data from implemented services 
        return this;
    }
    Service.prototype.cache = []; //store photo instances here as key/value pairs; assigned to prototype so it's share across all instances
    Service.prototype.mappedFunctions = {
        //map in chosen library (jQuery, MooTools, Dojo) context
        //or implement yourself
        //
        //merge: function () {...},
        //request: function () {...}
        
        //jQuery mappings
        //merge: function (target, reference) {
        //    return jQuery.extend(true, target, reference);
        //},
        //request: jQuery.getJSON
    };
    Service.prototype.init = function (configuration) {
        //this function is intended to be called by Child Functions which merges
        //the configuration object with defined default values
        var service = this,
            merge = service.mappedFunctions.merge;

        merge(service, service.defaults || {});
        merge(service, configuration || {});

        return service;
    };
    Service.prototype.filterParameters = function (parameters, filters) {
        //creates a querystring stub from filtered parameters
        //filters defined in Child Functions
        var filteredParameters = [],
            index,
            total,
            filter,
            parameter;

        for (index = 0, total = filters.length; index < total; index += 1) {
            filter = filters[index];
            parameter = parameters[filter];
            if (parameter) { //not undefined
                filteredParameters.push(filter + '=' + parameter);
            }
        }

        return filteredParameters.join('&');    
    };
    Service.prototype.getCachedPhotos = function () {
        return this.cache[this.getJsonURL(this.method)] || [];
    };
    Service.prototype.throwError = function (message, name) {
        var error = new Error(message);
        
        error.name = name;
        
        throw error;
    };
    //to be implemented in Child Functions
    //Child.prototype.getPhotos = function() {...};
    //Child.prototype.defaults = {...} default values
    ZS.PhotoService = Service; //expose Service Function so that Service.prototype.mappedFunctions can be implemented by 3rd party libraries
    
    //Flickr
    function FlickrPhoto(json) { //implementation of Photo
        return this.map(json);
    }
    ZS.inherit(FlickrPhoto, Photo);
    FlickrPhoto.prototype.site = "www.flickr.com";
    FlickrPhoto.prototype.map = (function () {
        //store static data in a closure
        var sizeMap = {
                Square: 'thumbnail',
                Thumbnail: 'tiny',
                Small: 'small',
                Medium: 'medium',
                Large: 'large',
                Original: 'original'
            };
        
        return function (json) {
            var photo = this,
                id = json.id,
                secret = json.secret,
                title = json.title,
                originalsecret = json.originalsecret,
                owner = json.owner,
                height = json.height_o || json.o_height,
                width = json.width_o || json.o_width,
                base,
                original,
                size;

            photo.author = json.ownername || owner.username;
            photo.id = id;
            photo.index = json.index;
            photo.link = "http://www.flickr.com/photos/" + (typeof(owner) === 'string' ? owner : owner.nsid) + "/" + id + "/";
            photo.title = (typeof(title) === 'string' ? title : title._content) || "[untitled]";
            photo.total = json.total;

            if (!json.size) { //is undefined
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

                if (!photo.original) { //is undefined
                    photo.original = photo.large || photo.medium;
                }
            }

            photo.updateAttribution();

            return photo;
        };
    }());
    
 
    function Flickr(configuration) { //implementation of Service
        return this.init(configuration);
    }
    ZS.inherit(Flickr, Service);
    Flickr.prototype.defaults = {
        parameters: {
            extras: "owner_name,original_format,o_dims"
        }
    };
    Flickr.prototype.filters = { //'api_key' is always required so it's added automatically in getJsonURL
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
        'flickr.photos.getSizes': ['photo_id']      
    };
    Flickr.prototype.getJsonURL = function (method) { 
        var flickr = this,
            filter = this.filters[(method || this.method)];

        if (!filter) { //is undefind
            flickr.throwError("Could not find corresponding filter for method = '" + (method || this.method) + "'; if method is correct than it is not yet supported by this implementation.");
        }
        
        return "http://api.flickr.com/services/rest/?format=json&jsoncallback=?&method=" + (method || this.method) + "&" + flickr.filterParameters(flickr.parameters, filter.concat(['api_key']));
    };
    Flickr.prototype.getPhotos = function (context, callback) {
        var flickr = this,
            url = this.getJsonURL(),
            cache = this.cache,
            request = this.mappedFunctions.request,
            urlSizes;
        
        if (cache[url]) { //not undefined
            callback(context, cache[url]);
        }
        else {      
            request(url, function (photosJSON) {
                if (photosJSON.stat === 'ok') {
                    if (flickr.method === 'flickr.photos.getInfo') {
                        urlSizes = flickr.getJsonURL('flickr.photos.getSizes');
                        request(urlSizes, function (sizesJSON) {
                            if (sizesJSON.stat === 'ok') {
                                cache[url] = flickr.mapPhotos(flickr.mappedFunctions.merge({index: 1, total: 1}, photosJSON.photo, sizesJSON.sizes));
                                callback(context, cache[url]);
                            }
                            else {
                                flickr.throwError("failed to retrieve JSON from Flickr using the following URL: " + urlSizes + (photosJSON ? "; Flickr returned message: " + photosJSON.message : "; no message received"));
                            }
                        });
                    }
                    else {
                        cache[url] = flickr.mapPhotos(photosJSON.photos || photosJSON.photoset);
                        callback(context, cache[url]);
                    }
                }
                else {
                    flickr.throwError("failed to retrieve JSON from Flickr using the following URL: " + url + (photosJSON ? "; Flickr returned message: " + photosJSON.message : "; no message received"));
                }
            });
        }
    };
    Flickr.prototype.mapPhotos = function (json) {
        var photos = [],
            total = json.photo.length,
            owner = json.owner,
            index,
            photosJSON;
      
        for (index = 0, photosJSON = json.photo; index < total; index += 1) {
            photos[index] = new FlickrPhoto(this.mappedFunctions.merge({index: index + 1, total: total, owner: owner}, photosJSON[index]));
        }

        return photos;
    };
    ZS.Flickr = Flickr; //add to ZS namespace
    
    // Picasa
    function PicasaPhoto(json) {
        return this.map(json);
    }
    ZS.inherit(PicasaPhoto, Photo);
    PicasaPhoto.prototype.site = "picasaweb.google.com";
    PicasaPhoto.prototype.map = function (json) {
        var photo = this;

        photo.author = json.feedAuthor || json.author[0].name.$t;
        photo.index = json.index;
        photo.link = json.link[2].href;
        photo.original = json.content.src;
        photo.thumbnail = json.media$group.media$thumbnail[0].url;
        photo.title = json.title.$t;
        photo.total = json.total;

        photo.updateAttribution();

        return photo;
    };

    function Picasa(configuration) {
        return this.init(configuration);
    }
    ZS.inherit(Picasa, Service);
    Picasa.prototype.defaults = {
        parameters: {
            imgmax: 1600, // Picasa currently limits image size for remote linking check with Picasa API for current limit
            thumbsize: '64c' // add a default "square" thumbmail for Picasa
        }
    };
    Picasa.prototype.getJsonURL = (function () { // create a closure so that filters, user, albumid will not have to be created with each call to getJsonURL
        var filter = ['access', 'alt', 'bbox', 'fields', 'imgmax', 'kind', 'l', 'max-results', 'prettyprint', 'q', 'start-index', 'tag', 'thumbsize'],
            user = "user/",
            album = "/albumid/";

        return function () {
            var picasa = this,
                userID = this.userID,
                albumID = this.albumID,
                url = "http://picasaweb.google.com/data/feed/api/";

            switch (picasa.method) {
            case 'user':
                url += user + userID;
                break;
            case 'album':
                url += user + userID + album + albumID;
                break;
            case 'photo':
                url += user + userID + album + albumID + "/photoid/" + picasa.photoID;
                break;
            case 'community':
                url += "all";
                break;
            case 'featured':
                url += "featured";
                break;
            default:
            }
            url += "?alt=json&callback=?&kind=photo&" + picasa.filterParameters(picasa.parameters, filter);

            return url;
        };
    }());
    Picasa.prototype.getPhotos = function (context, callback) {
        var picasa = this,
            url = this.getJsonURL(),
            cache = this.cache;

        if (cache[url]) {
            callback(context, cache[url]);
        }
        else {     
            picasa.mappedFunctions.request(url, function (photosJSON) {
                if (photosJSON) {
                    cache[url] = picasa.mapPhotos(photosJSON.feed);
                    callback(context, cache[url]);
                }
                else {
                    picasa.throwError("failed to retrieve JSON from Picasa using the following URL: " + url);
                }
            });
        }
    };
    Picasa.prototype.mapPhotos = function (json) {
        var photos = [],
            total = json.entry.length,
            author = json.author.length ? json.author[0].name.$t : undefined,
            index,
            photosJSON;
      
        for (index = 0, photosJSON = json.entry; index < total; index += 1) {
            photos[index] = new PicasaPhoto(this.mappedFunctions.merge({index: index + 1, total: total, feedAuthor: author}, photosJSON[index]));
        }

        return photos;
    };
    ZS.Picasa = Picasa; //add to ZS namespace
    
    //jQuery
    //ZS.PhotoService.prototype.mappedFunctions = {
    //    merge: function (target, reference) {
    //        return jQuery.extend(true, target, reference);
    //    },
    //    request: jQuery.getJSON
    //}
  
    //MooTools
    //ZS.PhotoService.prototype.mappedFunctions = {
    //    merge: Object.append,
    //    request: function (url, callback) {
    //        return Request.JSON({url: url, onSuccess: callback});
    //    }
    //}

    //Dojo
    //ZS.PhotoService.prototype.mappedFunctions = {
    //    merge: function (target, reference) {
    //        return dojo.mixin(target, reference);
    //    },
    //    request: function (configuration) {
    //        return dojo.(configuration.url, configuration.callback);
    //    }
    //}
    
    window.ZS = ZS;

}(window));

(function (jQuery, ZS) {
    var defaults = {
            empty: true, // empty contents of target container before appending image(s)
            limit: undefined, // maximum number of images to append; leave undefined to append all
            start: 0, // starting index, set to 'random' for random starting index
            increment: 1, //default increment for traversing retrieved images, set to -1 to traverse in reverse order
            link: false, // wrap image with link to image page at service (ie. flickr, Picasa)
            className: 'photo', //CSS class name used for <img> and <a>,<li> when generated
            random: false, // randomize sort order of retrieved images stored in indexes
            size: 'thumbnail', // original|thumbnail(square)|tiny(thumbnail at original aspect)|small|medium|large (avaiable sizes vary between services, selecting size that doesn't exist for particular image will default to original)
            preload: false,
            service: {}, // service (i.e. flickr & Picasa) specific settings  

            // settings that are not meant to be overridden, used for maintaining state by plugin
            currentIndex: undefined, // current index in the photos[] collection stored in cache[]
            indexes: [], // sorted indexes for photos[]; either random or ordered
            randomized: false // whether indexes[] has been randomized or not
        },
        key = 'photoService:configuration'; // url for use with jQuery.data(key) to store configuration by jQuery object to which plugin has been called upon
        
    ZS.PhotoService.prototype.mappedFunctions = {
        merge: function (target, reference) {
            return jQuery.extend(true, target, reference);
        },
        request: jQuery.getJSON
    };

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
            $html;

        if (!isNaN(currentIndex)) {
            currentIndex = ((!random && randomized) ? indexes[currentIndex] : currentIndex) + configuration.increment;

            if (currentIndex >= total) {
                currentIndex = 0;
            }
            else if (currentIndex < 0) {
                currentIndex = total - 1;
            }
        }
        else {
            currentIndex = (start === 'random') ? Math.floor(Math.random() * total) : start;
            indexes = [];
        }

        if (!indexes.length || random !== randomized) {
            for (index = 0; index < total; index += 1) {
                indexes[index] = index;
                randomized = false;
            }
            if (random) {
                indexes.sort(function () {
                    return 0.5 - Math.random();
                });
                randomized = true;
            }
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
            photo.loaded = true;
        }

        configuration.currentIndex = currentIndex;
        configuration.indexes = indexes;
        configuration.randomized = randomized;
        $this.data(key, configuration);
    }

    function preloadPhotos(photos, configuration) {
        var index = 0,
            total = photos.length,
            indexes = configuration.indexes,
            size = configuration.size,
            queue,
            photo;

        //load asynchronously
        queue = setInterval(function () {
            if (index < total) {
                photo = photos[indexes[index]];
                index += 1;
                if (!photo.loaded) {
                    new Image().src = photo[size] || photo.original;
                    photo.loaded = true;
                }
            }
            else {
                clearInterval(queue);
            }
        }, 1000);
    }

    function process($this, photos) {
        var successHandler,
            configuration = $this.data(key);
                
        successHandler = configuration.success;

        if (configuration.limit !== 0) {
            appendPhotos($this, photos, configuration);
        }

        if (typeof(successHandler) === 'function') {
            successHandler.call($this);
        }

        if (configuration.preload) {
            preloadPhotos(photos, configuration);
        }
    }

    jQuery.fn.photoService = function (new_configuration) {
        var $this = this,
            configuration = jQuery.extend(true, {}, defaults, $this.data(key), new_configuration),
            callback = process;

        $this.data(key, configuration);
        
        return $this.each(function () {
            configuration.service.getPhotos($this, callback, configuration);
        }); 
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
                return (!jQueryObject || !jQueryObject.data) ? [] : jQueryObject.data(key).service.getCachedPhotos();
            },
            getPhoto: function (jQueryObject) {
                var photos = this.getPhotos(jQueryObject),
                    configuration = this.getConfiguration(jQueryObject);

                return photos.length ? photos[configuration.indexes[configuration.currentIndex] || 0] : {};
            },
            Flickr: ZS.Flickr,
            Picasa: ZS.Picasa
        }
    });
}(jQuery, ZS));



