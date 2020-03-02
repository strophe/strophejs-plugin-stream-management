// Pawel: It seems that 'require.config.paths' in 'main.js' doesn't handle the '.js' suffix very well. Or maybe it does,
// but I don't know how to make it work... 'strophe.js' file placed in the 'tests' directory redefines the 'strophe.js'
// module by exporting 'strophe' configured in 'require.config.paths'.
define(['strophe'], function(strophe) {
    const { Status } = strophe.Strophe;

    function getStatusString(status) {
        switch (status) {
            case Status.ERROR:
                return 'ERROR';
            case Status.CONNECTING:
                return 'CONNECTING';
            case Status.CONNFAIL:
                return 'CONNFAIL';
            case Status.AUTHENTICATING:
                return 'AUTHENTICATING';
            case Status.AUTHFAIL:
                return 'AUTHFAIL';
            case Status.CONNECTED:
                return 'CONNECTED';
            case Status.DISCONNECTED:
                return 'DISCONNECTED';
            case Status.DISCONNECTING:
                return 'DISCONNECTING';
            case Status.ATTACHED:
                return 'ATTACHED';
            default:
                return 'unknown';
        }
    }

    return {
        getStatusString,
        ...strophe
    };
});
