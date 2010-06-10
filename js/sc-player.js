/*
*   SoundCloud Custom Player jQuery Plugin
*   Author: Matas Petrikas, matas@soundcloud.com
*   Copyright (c) 2009  SoundCloud Ltd.
*   Licensed under the MIT license:
*   http://www.opensource.org/licenses/mit-license.php
*
*   Usage:
*   <a href="http://soundcloud.com/matas/hobnotropic" class="sc-player">My new dub track</a>
*   The link will be automatically replaced by the HTML based player
*/
;(function($) {
  // Convert milliseconds into Hours (h), Minutes (m), and Seconds (s)
  var timecode = function(ms) {
    var hms = function(ms) {
          return {
            h: Math.floor(ms/(60*60*1000)),
            m: Math.floor((ms/60000) % 60),
            s: Math.floor((ms/1000) % 60)
          };
        }(ms),
        tc = []; // Timecode array to be joined with '.'

    if (hms.h > 0) {
      tc.push(hms.h);
    }

    tc.push((hms.m < 10 && hms.h > 0 ? "0" + hms.m : hms.m));
    tc.push((hms.s < 10  ? "0" + hms.s : hms.s));

    return tc.join('.');
  };

  var audioEngine = function() {
    var html5AudioAvailable = function() {
        var state = false;
        try{
          var a = new Audio();
          state = a.canPlayType && (/maybe|probably/).test(a.canPlayType('audio/mpeg'));
          // let's enable the html5 audio on selected mobile devices first, unlikely to support Flash
          // the desktop browsers are still better with Flash, e.g. see the Safari 10.6 bug
          // comment the following line out, if you want to force the html5 mode
          state = state &&  (/iPad|iphone|mobile|pre\//i).test(navigator.userAgent);
        }catch(e){
          // there's no audio support here sadly
        }
        return state;
    }(),
    callbacks = {
      onReady: function() {
        $(document).trigger('scPlayer:onAudioReady');
      },
      onPlay: function() {
        $(document).trigger('scPlayer:onMediaPlay');
      },
      onPause: function() {
        $(document).trigger('scPlayer:onMediaPause');
      },
      onEnd: function() {
        $(document).trigger('scPlayer:onMediaEnd');
      },
      onBuffer: function(percent) {
        $(document).trigger({type: 'scPlayer:onMediaBuffering', percent: percent});
      }
    };

    var html5Driver = function() {
      var player = new Audio(),
          onTimeUpdate = function(event){
            var obj = event.target,
                buffer = ((obj.buffered.length && obj.buffered.end(0)) / obj.duration) * 100;
            // ipad has no progress events implemented yet
            callbacks.onBuffer(buffer);
            // anounce if it's finished for the clients without 'ended' events implementation
            if (obj.currentTime === obj.duration) { callbacks.onEnd(); }
          },
          onProgress = function(event) {
            var obj = event.target,
                buffer = ((obj.buffered.length && obj.buffered.end(0)) / obj.duration) * 100;
            callbacks.onBuffer(buffer);
          };

      $('<div class="sc-player-engine-container"></div>').appendTo(document.body).append(player);

      // prepare the listeners
      player.addEventListener('play', callbacks.onPlay, false);
      player.addEventListener('pause', callbacks.onPause, false);
      player.addEventListener('ended', callbacks.onEnd, false);
      player.addEventListener('timeupdate', onTimeUpdate, false);
      player.addEventListener('progress', onProgress, false);


      return {
        load: function(track) {
          player.pause();
          player.src = track.stream_url;
          player.load();
          player.play();
        },
        play: function() {
          player.play();
        },
        pause: function() {
          player.pause();
        },
        seek: function(relative){
          player.currentTime = player.duration * relative;
          player.play();
        },
        getDuration: function() {
          return player.duration;
        },
        getPosition: function() {
          return player.currentTime;
        }
      };

    };



    var flashDriver = function() {
      var engineId = 'scPlayerEngine',
          player,
          flashHtml = function(url) {
            var swf = 'http://player.soundcloud.com/player.swf?url=' + url +'&amp;enable_api=true&amp;player_type=engine&amp;object_id=' + engineId;
            if ($.browser.msie) {
              return '<object height="100%" width="100%" id="' + engineId + '" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" data="' + swf + '">'+
                '<param name="movie" value="' + swf + '" />'+
                '<param name="allowscriptaccess" value="always" />'+
                '</object>';
            } else {
              return '<object height="100%" width="100%" id="' + engineId + '" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000">'+
                '<embed allowscriptaccess="always" height="100%" width="100%" src="' + swf + '" type="application/x-shockwave-flash" name="' + engineId + '" />'+
                '</object>';
            }
          };



      // listen to audio engine events
      // when the loaded track is ready to play
      soundcloud.addEventListener('onPlayerReady', function(flashId, data) {
        player = soundcloud.getPlayer(engineId);
        callbacks.onReady();
      });

      // when the loaded track finished playing
      soundcloud.addEventListener('onMediaEnd', callbacks.onEnd);

      // when the loaded track is still buffering
      soundcloud.addEventListener('onMediaBuffering', function(flashId, data) {
        callbacks.onBuffer(data.percent);
      });

      // when the loaded track started to play
      soundcloud.addEventListener('onMediaPlay', callbacks.onPlay);

      // when the loaded track is was paused
      soundcloud.addEventListener('onMediaPause', callbacks.onPause);

      return {
        load: function(track) {
          var url = track.permalink_url;
          if(player){
            player.api_load(url);
          }else{
            // create a container for the flash engine (IE needs this to operate properly)
            $('<div class="sc-player-engine-container"></div>').appendTo(document.body).html(flashHtml(url));
          }
        },
        play: function() {
          player && player.api_play();
        },
        pause: function() {
          player && player.api_pause();
        },
        seek: function(relative){
          player && player.api_seekTo((player.api_getTrackDuration() * relative));
        },
        getDuration: function() {
          return player && player.api_getTrackDuration && player.api_getTrackDuration();
        },
        getPosition: function() {
          return player && player.api_getTrackPosition && player.api_getTrackPosition();
        }
      };
    };

    return html5AudioAvailable? html5Driver() : flashDriver();

  }();



      var debug = false,
      useSandBox = false,
      log = function(args) {
        if(debug && window.console && window.console.log){
          window.console.log.apply(window.console, arguments);
        }
      },
      domain = useSandBox ? 'sandbox-soundcloud.com' : 'soundcloud.com',
      autoPlay = false,
      apiKey = 'htuiRd1JP11Ww0X72T1C3g',
      scApiUrl = function(url) {
        return (/api\./.test(url) ? url + '?' : 'http://api.' + domain +'/resolve?url=' + url + '&') + 'format=json&consumer_key=' + apiKey +'&callback=?';
      },
      players = [],
      updates = {},
      currentUrl,

      loadTracksData = function($player, links) {
        var index = 0,
            playerObj = {node: $player, tracks: []},
            loadUrl = function(link) {
              $.getJSON(scApiUrl(link.url), function(data) {
                // log('data loaded', link.url, data);
                index += 1;
                if(data.tracks){
                  log('data.tracks', data.tracks);
                  playerObj.tracks = playerObj.tracks.concat(data.tracks);
                }else if(data.duration){
                  // if track, add to player
                  playerObj.tracks.push(data);
                }else if(data.username){
                  // if user, get his tracks or favorites
                  if(/favorites/.test(link.url)){
                    links.push({url:data.uri + '/favorites'});
                  }else{
                    links.push({url:data.uri + '/tracks'});
                  }
                }else if($.isArray(data)){
                  playerObj.tracks = playerObj.tracks.concat(data);
                }
                if(links[index]){
                  // if there are more track to load, get them from the api
                  loadUrl(links[index]);
                }else{
                  // if loading finishes, anounce it to the GUI
                  playerObj.node.trigger({type:'onTrackDataLoaded.scPlayer', playerObj: playerObj});
                }
             });
           };
        // update the players queue
        players.push(playerObj);

        // load first tracks
        loadUrl(links[index]);
      },
      artworkImage = function(track, usePlaceholder) {
        if(usePlaceholder){
          return '<div class="sc-loading-artwork">Loading Artwork</div>';
        }else if (track.artwork_url) {
          return '<img src="' + track.artwork_url.replace('-large', '-t300x300') + '"/>';
        }else{
          return '<div class="sc-no-artwork">No Artwork</div>';
        }
      },
      updateTrackInfo = function($player, track) {
        // update the current track info in the player
        // log('updateTrackInfo', track);
        $('.sc-info', $player).each(function(index) {
          $('h3', this).html('<a href="' + track.permalink_url +'">' + track.title + '</a>');
          $('h4', this).html('by <a href="' + track.user.permalink_url +'">' + track.user.username + '</a>');
          $('p', this).html(track.description || 'no Description');
        });
        // update the artwork
        $('.sc-artwork-list li', $player).each(function(index) {
          var $item = $(this),
              itemTrack = $item.data('sc-track');

          if (itemTrack === track) {
            // show track artwork
            $item
              .addClass('active')
              .find('.sc-loading-artwork')
                .each(function(index) {
                  // if the image isn't loaded yet, do it now
                  $(this).removeClass('sc-loading-artwork').html(artworkImage(track, false));
                });
          }else{
            // reset other artworks
            $item.removeClass('active');
          }
        });
        // cache the references to most updated DOM nodes in the progress bar
        updates = {
          $buffer: $('.sc-buffer', $player),
          $played: $('.sc-played', $player),
          position:  $('.sc-position', $player)[0]
        };
        // update the track duration in the progress bar
        $('.sc-duration', $player).html(timecode(track.duration));
        // put the waveform into the progress bar
        var ourWaveform = waveformUrl + track.waveform_url.split('/').pop()
        $('.sc-waveform-container', $player).html('<img src="' + ourWaveform +'" />');

        $player.trigger('onPlayerTrackSwitch.scPlayer', [track]);
      },
      play = function(track) {
        var url = track.permalink_url;
        if(currentUrl === url){
          // log('will play');
          audioEngine.play();
        }else{
          currentUrl = url;
          // log('will load', url);
          audioEngine.load(track);
          autoPlay = true;
        }
      },
      getPlayerData = function(node) {
        return players[$(node).data('sc-player').id];
      },
      updatePlayStatus = function(player, status) {
        if(status){
          // reset all other players playing status
          $('div.sc-player.playing').removeClass('playing');
        }
        $(player)
          .toggleClass('playing', status)
          .trigger((status ? 'onPlayerPlay' : 'onPlayerPause') + '.scPlayer');
      },
      onPlay = function(player, id) {
        var track = getPlayerData(player).tracks[id || 0];
        updateTrackInfo(player, track);
        updatePlayStatus(player, true);
        play(track);
      },
      onPause = function(player) {
        updatePlayStatus(player, false);
        audioEngine.pause();
      },
      onSeek = function(player, relative) {
        audioEngine.seek(relative);
      },
      positionPoll;

    // listen to audio engine events
    $(document)
      .bind('scPlayer:onAudioReady', function(event) {
        log('onPlayerReady: audio engine is ready');
        audioEngine.play();
      })
      // when the loaded track started to play
      .bind('scPlayer:onMediaPlay', function(event) {
        clearInterval(positionPoll);
        positionPoll = setInterval(function() {
          var duration = audioEngine.getDuration() * 1000;
          var position = audioEngine.getPosition();
          updates.$played.css('width', ((position / audioEngine.getDuration()) * 100) + '%');
          updates.position.innerHTML = timecode(position * 1000);
        }, 50);
      })
      // when the loaded track is was paused
      .bind('scPlayer:onMediaPause', function(event) {
        clearInterval(positionPoll);
      })
      .bind('scPlayer:onMediaEnd', function(event) {
          log('track finished get the next one');
          //if there is a next track, continue
          next = $('.playing .sc-trackslist li.active').next('li');
          if (next.html()) {
            $(next).click();
          } else {
            // Hit the end of the set, reset status
            $('.playing .sc-trackslist li:first').addClass('active').siblings('li').removeClass('active');
            var player = $('.playing');
            var track = getPlayerData(player).tracks[0];
            updateTrackInfo(player, track);
            // update the next/prev buttons before we change playing status
            UpdateNextPrevButtons(flashId, data);
            updatePlayStatus(player, false);
            clearInterval(positionPoll);
            updates.$played.css('width', '0%');
            updates.position.innerHTML = timecode(0);
          }
      })
      .bind('scPlayer:onMediaBuffering', function(event) {
        updates.$buffer.css('width', event.percent + '%');
      });

  // Generate custom skinnable HTML/CSS/JavaScript based SoundCloud players from links to SoundCloud resources
  $.scPlayer = function(options, node) {
    var opts = $.extend({}, $.fn.scPlayer.defaults, options),
        playerId = players.length,
        $source = node && $(node),
        links = opts.links || $.map($('a', $source).add($source.filter('a')), function(val) { return {url: val.href, title: val.innerHTML}; }),
        $player = $('<div class="sc-player loading"></div>').data('sc-player', {id: playerId}),
        $artworks = $('<ol class="sc-artwork-list"></ol>').appendTo($player),
        $info = $('<div class="sc-info"><h3></h3><h4></h4><p></p><a href="#" class="sc-info-close">X</a></div>').appendTo($player),
        $controls = $('<div class="sc-controls"></div>').appendTo($player),
        $list = $('<ol class="sc-trackslist"></ol>').appendTo($player);

        // enable autoplay if set in the options
        autoPlay = opts.autoPlay;
        waveformUrl = opts.waveformUrl;

        // adding controls to the player
        $player
          .find('.sc-controls')
            .append('<a href="#prev" class="sc-prev disabled">Prev</a> <a href="#play" class="sc-play">Play</a> <a href="#pause" class="sc-pause hidden">Pause</a> <a href="#next" class="sc-next">Next</a>')
          .end()
          .append('<a href="#info" class="sc-info-toggle">Info</a>')
          .append('<div class="sc-scrubber"></div>')
            .find('.sc-scrubber')
              .append('<div class="sc-time-span"><div class="sc-waveform-container"></div><div class="sc-buffer"></div><div class="sc-played"></div></div>')
              .append('<div class="sc-time-indicators"><span class="sc-position"></span> | <span class="sc-duration"></span></div>');

        // load and parse the track data from SoundCloud API
        loadTracksData($player, links);
        // init the player GUI, when the tracks data was laoded
        $player.bind('onTrackDataLoaded.scPlayer', function(event) {
          // log('onTrackDataLoaded.scPlayer', event.playerObj, playerId, event.target);
          var tracks = event.playerObj.tracks;
          $.each(tracks, function(index, track) {
            var active = index === 0;
            // TODO this can be removed when api cookie auth is fixed
            if(track.sharing === "private"){
              return;
            }
            // create an item in the playlist
            $('<li><a href="' + track.permalink_url +'">' + track.title + '</a><span class="sc-track-duration">' + timecode(track.duration) + '</span></li>').data('sc-track', {id:index}).toggleClass('active', active).appendTo($list);
            // create an item in the artwork list
            $('<li></li>')
              .append(artworkImage(track, index >= opts.loadArtworks))
              .appendTo($artworks)
              .toggleClass('active', active)
              .data('sc-track', track);
          });
          $player
            .removeClass('loading')
            .trigger('onPlayerInit.scPlayer');
          // mark the next button disabled if there is only one track
          if (tracks.length < 2) {
            $player.find('a.sc-next').toggleClass('disabled', true);
          }

          // update the element before rendering it in the DOM
          $player.each(function() {
            if($.isFunction(opts.beforeRender)){
              opts.beforeRender.call(this, tracks);
            }
          });
          // set the first track's duration
          $('.sc-duration', $player)[0].innerHTML = timecode(tracks[0].duration);
          $('.sc-position', $player)[0].innerHTML = timecode(0);
          // set up the first track info
          updateTrackInfo($player, tracks[0]);
        });


    // replace the DOM source (if there's one)
    $source.each(function(index) {
      $(this).replaceWith($player);
    });

    return $player;
  };

  // plugin wrapper
  $.fn.scPlayer = function(options) {
    return this.each(function() {
      $.scPlayer(options, this);
    });
  };

  // default plugin options
  $.fn.scPlayer.defaults = {
    // do something with the dom object before you render it, add nodes, get more data from the services etc.
    beforeRender  :   function(tracksData) {
      var $player = $(this);
    },
    // initialization, when dom is ready
    onDomReady  : function() {
      $('a.sc-player, div.sc-player').scPlayer();
    },
    autoPlay: false,
    waveformUrl : '/sc/waveform/',
    loadArtworks: 5
  };


  // the GUI event bindings
  //--------------------------------------------------------

  // toggling play/pause
  $('a.sc-play, a.sc-pause').live('click', function(event) {
    var $list = $(this).closest('.sc-player').find('ol.sc-trackslist');
    // simulate the click in the tracklist
    $list.find('li.active').click();
    return false;
  });

  // displaying the info panel in the player
  $('a.sc-info-toggle, a.sc-info-close').live('click', function(event) {
    var $link = $(this);
    $link.closest('.sc-player')
      .find('.sc-info').toggleClass('active').end()
      .find('a.sc-info-toggle').toggleClass('active');
    return false;
  });

  // selecting tracks in the playlist
  $('.sc-trackslist li').live('click', function(event) {
    var $track = $(this),
        $player = $track.closest('.sc-player'),
        trackId = $track.data('sc-track').id,
        play = $player.is(':not(.playing)') || $track.is(':not(.active)');
    if (play) {
      onPlay($player, trackId);
    }else{
      onPause($player);
    }
    $track.addClass('active').siblings('li').removeClass('active');
    $('.artworks li', $player).each(function(index) {
      $(this).toggleClass('active', index === trackId);
    });
    return false;
  });

  var scrub = function(node, xPos) {
    var $scrubber = $(node).closest('.sc-time-span'),
        $buffer = $scrubber.find('.sc-buffer'),
        $available = $scrubber.find('.sc-waveform-container img'),
        $player = $scrubber.closest('.sc-player'),
        relative = Math.min($buffer.width(), (xPos  - $available.offset().left)) / $available.width();
    onSeek($player, relative);
  };

  var onTouchMove = function(ev) {
    if (ev.targetTouches.length === 1) {
      scrub(ev.target, ev.targetTouches && ev.targetTouches.length && ev.targetTouches[0].clientX);
      ev.preventDefault();
    }
  };

  // seeking in the loaded track buffer
  $('.sc-time-span')
    .live('click', function(event) {
      scrub(this, event.pageX);
      return false;
    })
    .live('touchstart', function(event) {
      this.addEventListener('touchmove', onTouchMove, false);
      event.originalEvent.preventDefault();
    })
    .live('touchend', function(event) {
      this.removeEventListener('touchmove', onTouchMove, false);
      event.originalEvent.preventDefault();
    });

  // enable forward and back buttons
  $('a.sc-next').live('click', function(event) {
      if (! $(this).hasClass('disabled')) {
      var parent = $(this).parents('div.sc-player');
      var next = $(parent).find('.sc-trackslist li.active').next('li');
      $(next).click();
      }
      return false;
  });
  $('a.sc-prev').live('click', function(event) {
      if (! $(this).hasClass('disabled')) {
      var parent = $(this).parents('div.sc-player');
      var prev = $(parent).find('.sc-trackslist li.active').prev('li');
      $(prev).click();
      }
      return false;
  });

  // listen to callbacks to enable/disable next and forward buttons
  // if we are at the beginning or end of the tracklist.
  function UpdateNextPrevButtons(flashId, data) {
     var player = $('div.sc-player.playing');
     if (player.length) {
     var next = $(player).find('.sc-trackslist li.active').next('li');
     $(player).find('a.sc-next').toggleClass('disabled', !next.length);
     var prev = $(player).find('.sc-trackslist li.active').prev('li');
     $(player).find('a.sc-prev').toggleClass('disabled', !prev.length);
     }
  }
  soundcloud.addEventListener('onPlayerReady', UpdateNextPrevButtons);

  // -------------------------------------------------------------------
  // the default Auto-Initialization
  $(function() {
    $.fn.scPlayer.defaults.onDomReady();
  });

})(jQuery);
