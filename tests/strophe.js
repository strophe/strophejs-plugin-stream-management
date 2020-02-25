// Pawel: It seems that 'require.config.paths' in 'main.js' doesn't handle the '.js' suffix very well. Or maybe it does,
// but I don't know how to make it work... 'strophe.js' file placed in the 'tests' directory redefines the 'strophe.js'
// module by exporting 'strophe' configured in 'require.config.paths'.
define(['strophe'], function(strophe) {
    return strophe;
});
