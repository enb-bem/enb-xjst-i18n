var path = require('path'),
    fs = require('fs'),
    mock = require('mock-fs'),
    serializeJS = require('serialize-javascript'),
    MockNode = require('mock-enb/lib/mock-node'),
    FileList = require('enb/lib/file-list'),
    dropRequireCache = require('enb/lib/fs/drop-require-cache'),
    Tech = require('../../../techs/bemhtml-i18n'),
    bemhtmlContents,
    core;

describe('bemhtml-i18n for bem-bl', function () {
    before(function () {
        var coreFilename = './test/fixtures/bem-core/common.blocks/i-bem/__i18n/i-bem__i18n.i18n/core.js',
            bemhtmlFilename = require.resolve('enb-xjst/node_modules/bem-bl-xjst/i-bem__html.bemhtml');
        core = fs.readFileSync(path.resolve(coreFilename), { encoding: 'utf-8' });
        bemhtmlContents = fs.readFileSync(bemhtmlFilename, { encoding: 'utf-8' });
    });

    afterEach(function () {
        mock.restore();
    });

    it('must throw err if i18n core is not found', function () {
        var keysets = {};

        return build(keysets)
            .fail(function (err) {
                err.must.a(Error);
                err.message.must.be('Core of i18n is not found!');
            });
    });

    it('must throw err if i18n core is not string', function () {
        var keysets = {
            all: {
                '': function () {}
            }
        };

        return build(keysets)
            .fail(function (err) {
                err.must.a(Error);
                err.message.must.be('Core of i18n is not found!');
            });
    });

    it('must throw err if i18n core is not valid', function () {
        var keysets = {
            all: {
                '': 'hello world'
            }
        };

        return build(keysets)
            .fail(function (err) {
                err.must.a(Error);
                err.message.must.be('Core of i18n is not found!');
            });
    });

    it('must return value', function () {
        var keysets = {
            all: {
                '': core
            },
            scope: {
                key: 'val'
            }
        };

        return build(keysets)
            .then(function (exports) {
                var BEMHTML = exports.BEMHTML,
                    bemjson = { block: 'foo', scope: 'scope', key: 'key' },
                    html = BEMHTML.apply(bemjson);

                html.must.be('<div class=\"foo\">val</div>');
            });
    });

    it('must return empty localization value for empty keysets (only core)', function () {
        var keysets = {
            all: { '': core }
        };

        return build(keysets)
            .then(function (exports) {
                var BEMHTML = exports.BEMHTML,
                    bemjson = { block: 'foo', scope: 'scope', key: 'key' },
                    html = BEMHTML.apply(bemjson);

                html.must.be('<div class=\"foo\"></div>');
            });
    });

    it('must build key by params', function () {
        var keysets = {
            all: {
                '': core
            },
            scope: {
                key: '<i18n:param>param</i18n:param> value'
            }
        };

        return build(keysets)
            .then(function (exports) {
                var BEMHTML = exports.BEMHTML,
                    bemjson = { block: 'foo', scope: 'scope', key: 'key', params: { param: 1 } },
                    html = BEMHTML.apply(bemjson);

                html.must.be('<div class=\"foo\">1 value</div>');
            });
    });

    describe('cache', function () {
        it('must get result from cache', function () {
            var time = new Date(1);

            mock({
                bundle: {
                    'bundle.keysets.lang.js': mock.file({
                        content: serialize({
                            all: { '': core },
                            scope: { key: 'val' }
                        }),
                        mtime: time
                    })
                }
            });

            var bundle = new MockNode('bundle'),
                cache = bundle.getNodeCache('bundle.bemhtml.lang.js'),
                basename = 'bundle.keysets.lang.js',
                relPath = path.join('bundle', basename),
                cacheKey = 'keysets-file-' + relPath,
                filename = path.resolve(relPath);

            dropRequireCache(require, filename);
            require(filename);
            cache.cacheFileInfo(cacheKey, filename);

            mock({
                blocks: {
                    'base.bemhtml': bemhtmlContents,
                    'foo.bemhtml': 'block foo, content: BEM.I18N(this.ctx.scope, this.ctx.key, this.ctx.params)'
                },
                bundle: {
                    'bundle.keysets.lang.js': mock.file({
                        content: serialize({
                            all: { '': core },
                            scope: { key: 'val2' }
                        }),
                        mtime: time
                    })
                }
            });

            var fileList = new FileList();

            fileList.loadFromDirSync('blocks');

            bundle.provideTechData('?.files', fileList);

            return bundle.runTechAndRequire(Tech, { lang: 'lang' })
                .spread(function (exports) {
                    var BEMHTML = exports.BEMHTML,
                        bemjson = {
                            block: 'foo',
                            scope: 'scope',
                            key: 'key'
                        },
                        html = BEMHTML.apply(bemjson);

                    html.must.be('<div class=\"foo\">val</div>');
                });
        });

        it('must ignore outdated cache', function () {
            mock({
                bundle: {
                    'bundle.keysets.lang.js': mock.file({
                        content: serialize({
                            all: { '': core },
                            scope: { key: 'val' }
                        }),
                        mtime: new Date(1)
                    })
                }
            });

            var bundle = new MockNode('bundle'),
                cache = bundle.getNodeCache('bundle.bemhtml.lang.js'),
                basename = 'bundle.keysets.lang.js',
                relPath = path.join('bundle', basename),
                cacheKey = 'keysets-file-' + relPath,
                filename = path.resolve(relPath);

            dropRequireCache(require, filename);
            require(filename);
            cache.cacheFileInfo(cacheKey, filename);

            mock({
                blocks: {
                    'base.bemhtml': bemhtmlContents,
                    'foo.bemhtml': 'block foo, content: BEM.I18N(this.ctx.scope, this.ctx.key, this.ctx.params)'
                },
                bundle: {
                    'bundle.keysets.lang.js': mock.file({
                        content: serialize({
                            all: { '': core },
                            scope: { key: 'val2' }
                        }),
                        mtime: new Date(2)
                    })
                }
            });

            var fileList = new FileList();

            fileList.loadFromDirSync('blocks');

            bundle.provideTechData('?.files', fileList);

            return bundle.runTechAndRequire(Tech, { lang: 'lang' })
                .spread(function (exports) {
                    var BEMHTML = exports.BEMHTML,
                        bemjson = {
                            block: 'foo',
                            scope: 'scope',
                            key: 'key'
                        },
                        html = BEMHTML.apply(bemjson);

                    html.must.be('<div class=\"foo\">val2</div>');
                });
        });
    });
});

function build(keysets) {
    mock({
        blocks: {
            'base.bemhtml': bemhtmlContents,
            'foo.bemhtml': 'block foo, content: BEM.I18N(this.ctx.scope, this.ctx.key, this.ctx.params)'
        },
        bundle: {
            'bundle.keysets.lang.js': serialize(keysets)
        }
    });

    var bundle = new MockNode('bundle'),
        fileList = new FileList();

    fileList.loadFromDirSync('blocks');

    bundle.provideTechData('?.files', fileList);

    return bundle.runTechAndRequire(Tech, { lang: 'lang' })
        .spread(function (i18n) {
            return i18n;
        });
}

function serialize(js) {
    return 'module.exports = ' + serializeJS(js) + ';';
}
