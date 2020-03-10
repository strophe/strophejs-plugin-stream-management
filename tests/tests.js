/* global equal, notEqual, ok, module, test */

define([
    'jquery',
    'strophe.js',
    'streammanagement',
    'MockServer',
    'TestStropheConnection'
    ], function($, wrapper, streammanagement, MockServer, TestStropheConnection) {
    const Strophe = wrapper.Strophe;
    const XMPP_DOMAIN = 'anonymous.server.com';
    const WEBSOCKET_URL = 'ws://localhost:8888';
    const JID = `8a5dce26-73ee-4505-bd0e-cb44bc3923dc@${XMPP_DOMAIN}/Q0TEoAmA`;

    const OPEN_STREAM = [
        `<open xml:lang='en' version='1.0' from='${XMPP_DOMAIN}' xmlns='urn:ietf:params:xml:ns:xmpp-framing' id='0cda18a2-6ec2-46e9-bf43-abad458caacb'/>`,
        "<stream:features xmlns:stream='http://etherx.jabber.org/streams' xmlns='jabber:client'><mechanisms xmlns='urn:ietf:params:xml:ns:xmpp-sasl'><mechanism>ANONYMOUS</mechanism></mechanisms></stream:features>"
    ];

    function createStreamAfterAuth({ isSmSupported }) {
        return isSmSupported
            ? [
                `<open xml:lang='en' version='1.0' from='${XMPP_DOMAIN}' xmlns='urn:ietf:params:xml:ns:xmpp-framing' id='860ef67e-6af1-4e6f-ad2d-22e124a1c0ca'/>`,
                "<stream:features xmlns:stream='http://etherx.jabber.org/streams' xmlns='jabber:client'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><required/></bind><session xmlns='urn:ietf:params:xml:ns:xmpp-session'><optional/></session><ver xmlns='urn:xmpp:features:rosterver'/><sm xmlns='urn:xmpp:sm:2'><optional/></sm><sm xmlns='urn:xmpp:sm:3'><optional/></sm><c hash='sha-1' node='http://prosody.im' ver='A5axPJ3bu8TW84XiqwpG16Sype8=' xmlns='http://jabber.org/protocol/caps'/></stream:features>"
            ]
            : [
                `<open xml:lang='en' version='1.0' from='${XMPP_DOMAIN}' xmlns='urn:ietf:params:xml:ns:xmpp-framing' id='860ef67e-6af1-4e6f-ad2d-22e124a1c0ca'/>`,
                "<stream:features xmlns:stream='http://etherx.jabber.org/streams' xmlns='jabber:client'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><required/></bind><session xmlns='urn:ietf:params:xml:ns:xmpp-session'><optional/></session><ver xmlns='urn:xmpp:features:rosterver'/></stream:features>"
            ];
    }

    function createSmNotSupported(continuation = []) {
        const stream = [
            OPEN_STREAM,
            "<success xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>",
            createStreamAfterAuth({ isSmSupported: false }),
            `<iq type='result' xmlns='jabber:client' id='_bind_auth_2'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><jid>${JID}</jid></bind></iq>`,
            `<iq xmlns='jabber:client' type='result' to='${JID}' id='_session_auth_2'/>`
        ];

        return stream.concat(continuation);
    }

    function createResumedStream({ resumeToken }) {
        return [
            OPEN_STREAM,
            "<success xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>",
            createStreamAfterAuth({ isSmSupported: true }),
            `<resumed xmlns='urn:xmpp:sm:3' h='0' previd='${resumeToken}'/>`,
            'result',
            'result'
        ];
    }

    function createFailedWithItemNotFound() {
        return [
            OPEN_STREAM,
            "<success xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>",
            createStreamAfterAuth({ isSmSupported: true }),
            "<failed xmlns='urn:xmpp:sm:3'>"+
                "<item-not-found xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>" +
            "</failed>"
        ];
    }

    function createFailedWithTooManyAck() {
        return [
                OPEN_STREAM,
                "<success xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>",
                createStreamAfterAuth({ isSmSupported: true }),
                "<stream:error xmlns:stream='http://etherx.jabber.org/streams' xmlns='jabber:client'>" +
                    "<undefined-condition xmlns='urn:ietf:params:xml:ns:xmpp-streams'/>" +
                    "<handled-count-too-high xmlns='urn:xmpp:sm:3' h='0' send-count='0'/>" +
                    "<text xml:lang='en' xmlns='urn:ietf:params:xml:ns:xmpp-streams'>" +
                        "You acknowledged X stanzas, but I only sent you 0 so far." +
                    "</text>" +
                "</stream:error>"
        ];
    }

    function createResponseStream({
        failToEnableResume,
        resumeToken
    }) {
        return [
            OPEN_STREAM,
            "<success xmlns='urn:ietf:params:xml:ns:xmpp-sasl'/>",
            createStreamAfterAuth({ isSmSupported: true }),
            `<iq type='result' xmlns='jabber:client' id='_bind_auth_2'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><jid>${JID}</jid></bind></iq>`,
            `<iq xmlns='jabber:client' type='result' to='${JID}' id='_session_auth_2'/>`,
            failToEnableResume
                ? "<failed xmlns='urn:xmpp:sm:3'><unexpected-request xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/></failed>"
                : `<enabled xmlns='urn:xmpp:sm:3' id='${resumeToken}' resume='true'/>`
        ];
    }

    function createTestPromise(mockServerOptions, executor) {
        const mockServer = new MockServer({
            wsUrl: WEBSOCKET_URL,
            xmppDomain: XMPP_DOMAIN,
            userJid: JID,
            ...mockServerOptions
        });

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                mockServer.cleanup();
                reject('The test got stuck?');
            }, 5000);

            const stropheConn = new TestStropheConnection({
                wsUrl: WEBSOCKET_URL,
                xmppDomain: XMPP_DOMAIN
            });

            stropheConn.connect();

            executor({ resolve, reject, stropheConn });
        }).then(
            () => mockServer.cleanup(),
            error => {
                mockServer.cleanup();

                throw error;
            });
    }

    var run = function () {
        QUnit.module("stream management");

        QUnit.test("is supported", assert => {
            // The test checks if the 'isSupported' flag is set and reset correctly. On the first connection it's
            // supported, but on the 2nd attempt is not.
            const firstConnection = createResponseStream({});

            // replace the <enabled> response with 'ignore' where the <close> msg will be received on disconnect
            firstConnection[firstConnection.length - 1] = 'ignore';
            firstConnection.push('ignore'); // presence unavailable

            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    firstConnection,
                    createSmNotSupported()
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => {
                        assert.equal(stropheConn.isSmSupported(), true, "check SM support");

                        stropheConn.c.disconnect();
                        assert.equal(stropheConn.status, Strophe.Status.DISCONNECTED, 'disconnected status');

                        stropheConn.connect();

                        return stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    })
                    .then(() => {
                        assert.equal(stropheConn.isSmSupported(), false, "check not supported");
                    })
                    .then(resolve, reject);
            });
        });
        QUnit.test("enable stream resume", assert => {
            const resumeToken = '1257';
            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    createResponseStream({ resumeToken })
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), resumeToken, 'check resume token');
                    })
                    .then(resolve, reject);
            });
        });

        QUnit.test("failed to enable stream resume", assert => {
            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    createResponseStream({ failToEnableResume: true })
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => {
                        stropheConn.c.streamManagement.enable(/* resume */ true);
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.ERROR))
                    .then(({ elem }) => {
                        assert.equal(elem.nodeName, 'failed', 'failed element nodeName');
                        assert.equal(elem.namespaceURI, 'urn:xmpp:sm:3', 'failed element xmlns');
                        resolve();
                    });
            });
        });

        QUnit.test("resume no unacked stanzas", assert => {
            const resumeToken = '1257';
            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    createResponseStream({ resumeToken }),
                    createResumedStream({ resumeToken })
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        // Close the websocket which should now transition Strophe to DISCONNECTED
                        stropheConn.c._proto.socket.close();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.DISCONNECTED))
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), resumeToken, 'check resume token');
                        stropheConn.c.streamManagement.resume();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.CONNECTED))
                    .then(resolve, reject);
            });
        });

        QUnit.test('closed on the 1st resume attempt', assert => {
            const resumeToken = '1234';
            const disruptedStream = createResumedStream({ resumeToken });

            disruptedStream[2]  = 'close';

            const mockServerOptions = {
                assert,
                responseStreams:[
                    createResponseStream({ resumeToken }),
                    disruptedStream,
                    createResumedStream({ resumeToken })
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        stropheConn.c._proto.socket.close();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.DISCONNECTED))
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), resumeToken, 'check resume token');
                        stropheConn.c.streamManagement.resume();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.DISCONNECTED))
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), resumeToken, 'check token not lost');
                        stropheConn.c.streamManagement.resume();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.CONNECTED))
                    .then(resolve, reject);
            });
        });

        QUnit.test("resume with unacked stanzas", assert => {
            const resumeToken = '1257';
            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    createResponseStream({ resumeToken }),
                    createResumedStream({ resumeToken })
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                let ping1Promise, ping2Promise;

                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        // Override Websocket's send method to not send the IQs as if the network link was broken.
                        stropheConn.c._proto.socket.send = () => { };

                        ping1Promise = stropheConn.sendPingIQ();
                        ping2Promise = stropheConn.sendPingIQ();

                        // Close the websocket and make Strophe the connection's been dropped
                        stropheConn.c._proto.socket.close();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.DISCONNECTED))
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), resumeToken, 'check resume token');
                        stropheConn.c.streamManagement.resume();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.CONNECTED))
                    .then(()  => {
                        assert.notEqual(ping1Promise, undefined);
                        assert.notEqual(ping2Promise, undefined);

                        return ping1Promise
                            .then(() => ping2Promise)
                            .then(resolve, reject);
                    });
            });
        });

        QUnit.test("resume failed with too many acknowledged stanzas", assert => {
            const resumeToken = '1257';
            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    createResponseStream({ resumeToken }),
                    createFailedWithTooManyAck()
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        // Modify the client processed counter to make server return an error on resume
                        stropheConn.c.streamManagement._clientProcessedStanzasCounter += 2;
                        // Close the websocket and make Strophe the connection's been dropped
                        stropheConn.c._proto.socket.close();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.DISCONNECTED))
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken() , resumeToken, 'check resume token');
                        stropheConn.c.streamManagement.resume();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.ERROR))
                    .then(({ error }) => {
                        assert.equal(error, 'undefined-condition', 'check undefined-condition');
                        assert.equal(stropheConn.status, Strophe.Status.DISCONNECTED, 'disconnected status');
                        assert.equal(stropheConn.c.streamManagement.getResumeToken() , undefined, 'resume token cleared');
                    })
                    .then(resolve, reject);
            });
        });
        QUnit.test("resume failed with item-not-found", assert => {
            const resumeToken = '1257';
            const mockServerOptions = {
                assert,
                wsUrl: WEBSOCKET_URL,
                responseStreams: [
                    createResponseStream({ resumeToken }),
                    createFailedWithItemNotFound()
                ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        // Close the websocket and make Strophe the connection's been dropped
                        stropheConn.c._proto.socket.close();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.DISCONNECTED))
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken() , resumeToken, 'check resume token');

                        // Set invalid resume token
                        stropheConn.c.streamManagement._resumeToken = 'invalid123';

                        stropheConn.c.streamManagement.resume();
                    })
                    .then(() => stropheConn.awaitStatus(Strophe.Status.ERROR))
                    .then(({ elem, error }) => {
                        assert.equal(elem.tagName, 'failed', 'check failed element');
                        assert.equal(elem.namespaceURI, 'urn:xmpp:sm:3', 'check failed namespace');
                        assert.equal(error, 'item-not-found', 'item-not-found error');
                        assert.equal(
                            elem.getElementsByTagNameNS(
                                'urn:ietf:params:xml:ns:xmpp-stanzas',
                                'item-not-found').length,
                            1,
                            'check item-not-found');
                        assert.equal(stropheConn.status, Strophe.Status.DISCONNECTED, 'disconnected status');
                        assert.equal(stropheConn.c.streamManagement.getResumeToken() , undefined, 'resume token cleared');
                    })
                    .then(resolve, reject);
            });
        });
        QUnit.test('stanza acknowledgment', (assert) => {
            const resumeToken = '1257';
            const responseStream = createResponseStream({ resumeToken });

            const STANZA_COUNT = Strophe._connectionPlugins.streamManagement.requestResponseInterval;

            for  (let i = 0; i < STANZA_COUNT; i++) {
                responseStream.push('result');
            }

            const mockServerOptions = {
                assert,
                responseStreams: [ responseStream ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                let pingPromises = [];

                const waitForStanzasAck = new Promise((resolve, reject) => {
                    let counter = 0;
                    stropheConn.c.streamManagement.addAcknowledgedStanzaListener(() => {
                        counter += 1;
                        if (counter === STANZA_COUNT) {
                            resolve();
                        }
                    });
                    setTimeout(() => reject('AcknowledgedStanzaListener timeout'), 5000);
                });

                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        for (let i = 0; i < STANZA_COUNT; i++) {
                            pingPromises.push(stropheConn.sendPingIQ());
                        }
                    })
                    .then(()  => {
                        assert.equal(pingPromises.length, STANZA_COUNT);

                        return Promise.all(pingPromises);
                    })
                    .then(()  => waitForStanzasAck)
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement._serverProcesssedStanzasCounter, STANZA_COUNT);
                    })
                    .then(resolve, reject);
            });
        });
        QUnit.test("disconnect", function(assert) {
            const resumeToken = '1234';
            const responseStream = createResponseStream({ resumeToken });

            responseStream.push('ignore'); // Ignore <presence type="unavailable" xmlns="jabber:client"/>
            responseStream.push('ignore'); // Ignore <close xmlns="urn:ietf:params:xml:ns:xmpp-framing"/>

            const mockServerOptions = {
                assert,
                responseStreams:[ responseStream ]
            };

            return createTestPromise(mockServerOptions, ({ resolve, reject, stropheConn }) => {
                stropheConn.awaitStatus(Strophe.Status.CONNECTED)
                    .then(() => stropheConn.enableStreamResume())
                    .then(() => {
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), resumeToken, 'check resume token');
                        stropheConn.c.disconnect();
                        assert.equal(stropheConn.status, Strophe.Status.DISCONNECTED, 'disconnected status');
                        assert.equal(stropheConn.c.streamManagement.getResumeToken(), undefined,  'resume token cleared');
                    })
                    .then(resolve, reject);
            });
        });
   };
    return {run: run};
});
