
/**
 * Module dependencies.
 */

var ws = require('websocket.io')
  , qs = require('querystring')
  , parse = require('url').parse
  , readFileSync = require('fs').readFileSync
  , transports = require('./transports')
  , cluster = require('cluster')
  , EventEmitter = require('events').EventEmitter
  , Socket = require('./socket')
  , debug = require('debug')('engine:server')

/**
 * Module exports.
 */

module.exports = Server;

/**
 * Server constructor.
 *
 * @param {Object} options
 * @api public
 */

function Server (opts) {
  this.clients = {};
  this.clientsCount = 0;

  opts = opts || {};
  this.pingTimeout = opts.pingTimeout || 60000;
  this.pingInterval = opts.pingInterval || 25000;
  this.upgradeTimeout = opts.upgradeTimeout || 10000;
  this.transports = opts.transports || Object.keys(transports);
  this.allowUpgrades = false !== opts.allowUpgrades;

  // worker interoperability
  this.inCluster = cluster.isWorker;
  if (this.inCluster) {
    this.proxied = [];
    this.sources = {};
    this.workerID = cluster.worker.uniqueID;
  }

  // initialize websocket server
  if (~this.transports.indexOf('websocket')) {
    this.ws = new ws.Server;
    this.ws.on('connection', this.onWebSocket.bind(this));
  }
};

/**
 * Inherits from EventEmitter.
 */

Server.prototype.__proto__ = EventEmitter.prototype;

/**
 * Hash of open clients.
 *
 * @api public
 */

Server.prototype.clients;

/**
 * Returns a list of available transports for upgrade given a certain transport.
 *
 * @return {Array}
 * @api public
 */

Server.prototype.upgrades = function (transport) {
  if (!this.allowUpgrades) return [];
  return transports[transport].upgradesTo || [];
};

/**
 * Verifies a request.
 *
 * @param {http.ServerRequest} request
 * @param {Function} callback
 * @api private
 */

Server.prototype.verify = function (req, fn) {
  // transport check
  var transport = req.query.transport;
  if (!~this.transports.indexOf(transport)) {
    debug('unknown transport "%s"', transport);
    return fn(null, false);
  }

  // sid check
  if (req.query.sid) {
    if (this.inCluster) {
      debug('verifying request sid in cluster mode');

      // avoid IPC if possible
      if (this.clients.hasOwnProperty(req.query.sid)) {
        process.nextTick(function () {
          fn(null, true);
        });
      } else {
        this.master('verify', req.query.sid, function (verified) {
          fn(null, verified);
        });
      }
    } else {
      debug('verifying request sid in single mode');
      var self = this;
      process.nextTick(function () {
        fn(null, self.clients.hasOwnProperty(req.query.sid));
      });
    }
  } else {
    // handshake is GET only
    process.nextTick(function () {
      fn(null, 'GET' == req.method);
    });
  }
};

/**
 * Call a remote method on the master process.
 *
 * @api private
 */

Server.prototype.master = function (name) {
  var args = Array.prototype.slice.call(arguments, 1)

  if (!this.rpc) {
    var rpc = this.rpc = {
        count: 0
      , callbacks: []
    };

    process.on('message', function (msg) {
      if (msg && msg.__engine_io) {
        rpc.callbacks[msg.id].apply(null, msg.args);
      }
    });
  }

  var packet = {
      __engine_io: 1
    , fn: name
    , args: args
    , wid: this.workerID
  };

  if ('function' == typeof args[args.length - 1]) {
    this.rpc.callbacks.push(args.pop());
    packet.id = this.rpc.count++;
  }

  process.send(packet);
};

/**
 * Prepares a request by processing the query string.
 * 
 * @api private
 */

Server.prototype.prepare = function (req) {
  // try to leverage pre-existing `req.query` (e.g: from connect)
  if (!req.query) {
    req.query = ~req.url.indexOf('?')
      ? qs.parse(parse(req.url).query)
      : {};
  }

  return req;
};

/**
 * Generates an id.
 *
 * @api private
 */

Server.prototype.id = function () {
  return String(Math.random() * Math.random()).substr(3);
};

/**
 * Closes all clients.
 *
 * @api public
 */

Server.prototype.close = function () {
  debug('closing all open clients');
  for (var i in this.clients) {
    this.clients[i].close();
  }
  return this;
};

/**
 * Creates a proxy object.
 * This method is meant to be RPCd by other workers.
 *
 * @param {Worker} source worker
 * @param {Object} properties to populate the object with
 * @param {Array} array of remote functions to stub out
 * @param {Function} rpc callback
 */

Server.prototype.createProxy = function (worker, obj, remote, fn) {
  var oid = this.proxied.length;
  obj.__proto__ = EventEmitter.prototype;

  remote.forEach(function (fn) {
    obj[fn] = function () {
      self.worker(worker.uniqueID, 'sourceCall', fn);
    }
  });

  this.proxied.push(obj);
  callback(oid);
};

Server.prototype.proxyEvent = function (worker, oid, ev, args) {
  args.unshift(ev);
  this.proxied[oid].emit.apply(this.proxied[oid], args);
}

/**
 * Handles an Engine.IO HTTP request.
 *
 * @param {http.ServerRequest} request
 * @param {http.ServerResponse|http.OutgoingMessage} response
 * @api public
 */

Server.prototype.handleRequest = function (req, res) {
  debug('handling "%s" http request "%s"', req.method, req.url);
  this.prepare(req);
  req.res = res;

  var self = this;

  this.verify(req, function (err, verified) {
    if (err || !verified) {
      if (err) {
        debug('request verification error');
      } else {
        debug('request could not be verified');
      }

  return this;
};

/**
 * Handshakes a new client.
 *
 * @param {String} transport name
 * @param {Object} request object
 * @api private
 */

Server.prototype.handshake = function (transport, req) {
  var id = this.id();

  debug('handshaking client "%d"', id);

  var socket = new Socket(id, this, new transports[transport](req))
    , self = this

  this.clients[id] = socket;
  this.clientsCount++;
  this.emit('connection', socket);

  socket.once('close', function () {
    delete self.clients[id];
    self.clientsCount--;
  });
};

/**
 * Handles an Engine.IO HTTP Upgrade.
 *
 * @api public
 */

Server.prototype.handleUpgrade = function (req, socket, head) {
  this.prepare(req);

  if (!this.verify(req)) {
    debug('upgrade verification failed');
    socket.end();
    return;
  }

  // delegate to websocket.io
  this.ws.handleUpgrade(req, socket, head);
};

/**
 * Called upon a ws.io connection.
 *
 * @param {wsio.Socket} websocket
 * @api private
 */

Server.prototype.onWebSocket = function (socket) {
  var req = socket.req
    , id = req.query.sid

  if (id) {
    if (this.clients[id].upgraded) {
      debug('transport had already been upgraded');
      socket.close();
    } else {
      debug('upgrading existing transport');
      var transport = new transports[req.query.transport](socket);
      this.clients[id].maybeUpgrade(transport);
    }
  } else {
    this.handshake(req.query.transport, socket);
  }

};

/**
 * Handles a regular connection to watch for flash policy requests.
 *
 * @param {net.Stream} socket
 * @api private
 */

var policy = readFileSync(__dirname + '/transports/flashsocket.xml');

Server.prototype.handleSocket = function (socket) {
  var chunks = ''
    , buffer = false

  socket.on('data', function onData (data) {
    if (!buffer && 60 == data[0]) {
      buffer = true;
    } else {
      socket.removeListener('data', onData);
      return;
    }

    if (chunks.length < 23) {
      chunks += data.toString('ascii');
    }

    if (chunks.length >= 23) {
      if ('<policy-file-request/>\0' == chunks.substr(0, 23)) {
        socket.end(policy);
      } else {
        chunks = null;
        socket.removeListener('data', onData);
      }
    }
  });
};
