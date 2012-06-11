
/**
 * Test dependencies.
 */

var cp = require('child_process')

/**
 * Test.
 */

describe('cluster', function () {

  var cluster, onMessage

  it('should spawn the workers', function (done) {
    var total = 4;

    cluster = cp.fork(__dirname + '/fixtures/cluster.js');
    cluster.on('message', function (msg) {
      onMessage(msg);
    });

    onMessage = function (msg) {
      if (msg.id && 'listen' == msg.type) {
        --total || done();
      }
    }
  });

  it('should accept requests to different workers', function (done) {
    var socket = new eioc.Socket('ws://localhost:10000');
    socket.on('message', function (msg) {
      socket.send(msg);
      onMessage = function (chk) {
        expect(chk.type).to.be('upgrade');
        done();
      }
    });
  });

});
