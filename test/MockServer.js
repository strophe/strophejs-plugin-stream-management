// const WebSocket = require('ws');
const { WebSocket, Server } = require('mock-socket');
global.WebSocket = WebSocket;

module.exports =
    class MockServer {
        constructor({ assert, responseStreams, userJid, wsUrl, xmppDomain }) {
            this.mockServer = new Server(wsUrl);
            let socketCounter = 0;

            this.mockServer.on('connection', socket => {
                const socketIdx = socketCounter;

                socketCounter += 1;

                socket.respIdx = 0;
                let processedStanzas = 0;
                socket.on('message', msg => {
                    console.info('Server received:', msg);
                    let responseStream = responseStreams[socketIdx];

                    if (!responseStream) {
                        socket.close(1000, 'unexpected connection');

                        return;
                    }

                    let response;
                    if (msg.startsWith('<r xmlns="urn:xmpp:sm:3"')) {
                        response = `<a xmlns="urn:xmpp:sm:3" h="${processedStanzas}" />`;
                    } else if (msg === '<close xmlns="urn:ietf:params:xml:ns:xmpp-framing"/>') {
                        response = 'close';
                    } else {
                        response = responseStream[socket.respIdx];
                        socket.respIdx += 1;
                    }

                    console.info('Server response:', response);

                    if (Array.isArray(response)) {
                        for (const r of response) {
                            socket.send(r);
                        }
                    } else if (response) {
                        if (response === 'result') {
                            processedStanzas += 1;
                            const id = msg.match(' id="(.*):sendIQ" ')[1];
                            response = `<iq type='result' from='${xmppDomain}' to='${userJid}' xmlns='jabber:client' id='${id}:sendIQ'/>`
                        } else if (response === 'ignore') {

                            return;
                        } else if (response === 'close') {
                            socket.close();

                            return;
                        }
                        socket.send(response);
                    } else {
                        assert.ok(false, "Unexpected msg received: " + msg);
                        socket.close();
                    }
                })
            });
        }

        cleanup() {
            for (const client of this.mockServer.clients()) {
                client.close(1000, 'test cleanup');
            }
            this.mockServer.stop();
        }
    };
