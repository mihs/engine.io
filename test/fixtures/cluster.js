
/**
 * Module dependencies.
 */

var cluster = require('cluster')
  , http = require('http')
  , eio = require('../../lib/engine.io')
  , procs = 4

/**
 * Master.
 */

if (cluster.isMaster) {
  for (var i = 0; i < procs; i++) {
    cluster.fork().on('message', function (msg) {
      // forward the message so the test can capture it
      process.send(msg);
    });
  }

  cluster.on('exit', function () {
    throw new Error('Cluster error');
  });
} else {
  var server = http.createServer();
  server.listen(10000, function () {
    process.send({ id: cluster.worker.uniqueID, type: 'listen' });
  });

  var engine = eio.attach(server);
  engine.on('connection', function (conn) {
    conn.send(cluster.worker.uniqueID);
    conn.on('upgrade', function (data) {
      process.send({
          id: cluster.worker.uniqueID
        , type: 'upgrade'
      });
    });
  });
}
