define(['strophe.js'], function(wrapper) {
    const { getStatusString, Strophe } = wrapper;
    const $iq = wrapper.$iq;

    class TestStropheConnection {
        constructor({ wsUrl, xmppDomain }) {
            this.xmppDomain = xmppDomain;
            this.c = new Strophe.Connection(wsUrl);
        }

        connect() {
            this.c.connect(
                this.xmppDomain,
                null,
                this._connect_cb.bind(this));
        }

        _connect_cb(status, error, elem) {
            this.status = status;
            console.info('Strophe conn status', getStatusString(status), error, elem);
            const statusObserver = this._statusObserver;

            if (statusObserver && statusObserver.status === status) {
                this._statusObserver = undefined;
                statusObserver.resolve({ status, error, elem});
            }
        }

        enableStreamResume() {
            this.c.streamManagement.enable(/* resume */ true);

            return this.awaitResumeEnabled();
        }

        awaitStatus(status, timeout = 2000) {
            return new Promise((resolve, reject) => {
                this._statusObserver = {
                    status,
                    resolve
                };
                setTimeout(() => reject('Wait for ' + getStatusString(status) + ' timeout'), timeout);
            });
        }

        awaitResumeEnabled(timeout = 2000) {
            return new Promise((resolve, reject) => {
                // Strophe calls it's resume method after streamManagement plugin enables stream resumption - override
                // the function to catch the exact moment.
                const originalResume = this.c.resume;
                this.c.resume = () => {
                    this.c.resume = originalResume;
                    originalResume.call(this.c);

                    resolve();
                };
                setTimeout(() => reject('Wait for resumed timeout'), timeout);
            });
        }

        isSmSupported() {
            return this.c.streamManagement.isSupported();
        }

        sendPingIQ(timeout = 2000) {
            return new Promise((resolve, reject) => {
                this.c.sendIQ($iq({
                        to: this.xmppDomain,
                        type: 'get' })
                        .c('ping', { xmlns: 'urn:xmpp:ping' }),
                    resolve,
                    error => {
                        reject('Send ping error: ' + error && error.message);
                    },
                    timeout);
            });
        }
    }

    return TestStropheConnection;
});
