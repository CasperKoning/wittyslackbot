'use strict';
var http = require('http')
// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const Wit = require('./').Wit;

var RtmCLient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

const token = (() => {
  if (process.argv.length !== 5) {
    console.log('usage: node examples/quickstart.js <wit-token> <slack-token> <slack-channel>');
    process.exit(1);
  }
  return process.argv[2];
})();

const slackToken = (() => {
  if (process.argv.length !== 5) {
    console.log('usage: node examples/quickstart.js <wit-token> <slack-token> <slack-channel>');
    process.exit(1);
  }
  return process.argv[3];
})();

const slackChannel = (() => {
  if (process.argv.length !== 5) {
    console.log('usage: node examples/quickstart.js <wit-token> <slack-token> <slack-channel>');
    process.exit(1);
  }
  return process.argv[4];
})();

var rtm = new RtmCLient(slackToken, {logLevel: 'info'});
var slackbot;

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

function lookupMovieRating(title, ratingCB) {
  var options = {
    host: 'omdbapi.com',
    path: '/?t='+encodeURI(title),
    method: 'GET',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    }
  };

  var req = http.request(options, function(res){
    var msg = '';

    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      msg += chunk;
    });
    res.on('end', function(){
      ratingCB(JSON.parse(msg).imdbRating);
    });
  });

  req.end();
}

const actions = {
  say(sessionId, context, message, cb) {
    rtm.sendMessage(message, slackChannel);
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    const loc = firstEntityValue(entities, 'location');
    if (loc) {
      context.loc = loc;
    }

    // Retrieve the animal entity and store it into a context field
    const animal = firstEntityValue(entities, 'animal');
    if(animal) {
      context.animal = animal;
    }

    const movie = firstEntityValue(entities, 'movie');
    if(movie) {
      context.movie = movie;
    }

    const number = firstEntityValue(entities, "number");
    if(number) {
      const parsedNumber = parseInt(number);
      context.number = parsedNumber;
    }

    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  ['fetch-weather'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    context.forecast = 'apocalyptic';
    cb(context);
  },
  ['lookup-animal-preference'](sessionId, context, cb) {
    context.animal_preference = `${context.animal} are cool!`;
    cb(context);
  },
  ['lookup-movie-rating'](sessionId, context, cb) {
    lookupMovieRating(context.movie, function(movie_rating){
      context.movie_rating = movie_rating;
      cb(context);
    });
  },
  ['is-number-correct'](sessionId, context, cb) {
    let correct_number_sentence;
    if(context.number && context.number === 42) {
      correct_number_sentence = "That's Numberwang!"
    } else {
      correct_number_sentence = "Nope, that's not it"
    }
    context.correct_number_sentence = correct_number_sentence;
    context.number = null;
    cb(context);
  }
};

const sessions = {};

const findOrCreateSession = (id) => {
 let session;
 // Let's see if we already have a session for the user id
 Object.keys(sessions).forEach(k => {
   if (sessions[k].id === id) {
     // Yep, got it!
     session = k;
   }
 });
 if (!session) {
   // No session found for user id, let's create a new one
   session = new Date().toISOString();
   sessions[session] = {id: id, context: {}};
 }
 return session;
};

const client = new Wit(token, actions);

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
  slackbot = rtmStartData.self;
});

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function() {
  rtm.sendMessage("I'M ALIVE", slackChannel);
});

rtm.on(RTM_EVENTS.MESSAGE, function (message) {
  if (message.user == slackbot.id) return; // Ignore bot's own messages
  if (message.user == "USLACKBOT") return; // Ignore slackbot
  var sessionId = findOrCreateSession(message.user);
  if (message.text && message.text.toLowerCase().indexOf("thanks") > -1) {
    sessions[sessionId] = {id: message.user, context: {}};
  }
  console.log(sessions);

  client.runActions(
    sessionId,
    message.text,
    sessions[sessionId].context,
    (error, context) => {
      if(error) {
        console.log(`ERRORRRRRR ${error}`)
      } else {
        sessions[sessionId].context = context;
      }
    });
});

rtm.start();
