import Component from '@ember/component';
import { task, timeout } from 'ember-concurrency';
import { isBlank, isEmpty } from '@ember/utils';
import $ from 'jquery';

const DEBOUNCE_MS = 250;

export default Component.extend({
    attributeBindings: ['contenteditable', 'spellcheck', 'data-placeholder'],

    classNames: ['at-mention'],

    contenteditable: true,

    spellcheck: false,

    didInsertElement () {
        this.setupAtMention();
    },

    highlightTag () {
        let obj = this.get('atWhoCls'),
            query = obj.query.el;

        // Check current flag is hash tag
        if (obj && query.length > 0 && obj.app.currentFlag === '#') {
            let node = query.text(query.text()).contents().first(),
                nodeData = node[0];

            // If no content to parse, stop further execution
            if(isEmpty(nodeData)) {
                return false;
            }

            let hashtagText = nodeData.data,
                specialChar = null;

            // Check any special character available
            var index = nodeData.data.search(/[*?+^${}[\]().,|\\\s]/);
            if (index >= 0) {
                hashtagText = nodeData.data.substring(0, index),
                specialChar = nodeData.data.substring(index);
            }

            // Reset current text node value
            node.nodeValue="";

            // Create a tag and append before text node
            var link= document.createElement('a');
            link.href= 'http://www.example.com/';
            link.textContent = hashtagText;
            node[0].parentNode.insertBefore(link, node.textNode);


            // Create text node and append it
            if (!isEmpty(specialChar)) {
                var textNode = document.createTextNode(specialChar);
                node[0].parentNode.insertBefore(textNode, node.nextSibling);
            }

            // Remove span tag
            node = $(node).unwrap().get(0);
            node.nodeValue = null;

            // Set cursor position
            this.get('atWhoCls')._setRange("after", textNode);
        }
    },

    focusOut () {
        this.highlightTag();
    },

    keyPress (e) {
        if (e.keyCode === 13 || e.keyCode === 9) {
            this.highlightTag();
        }
	},

    remoteFilter: task(function * (term, callback) {
        if (isBlank(term)) { return []; }

        // Pause here for DEBOUNCE_MS milliseconds. Because this
        // task is `restartable`, if the user starts typing again,
        // the current search will be canceled at this point and
        // start over from the beginning. This is the
        // ember-concurrency way of debouncing a task.
        yield timeout(DEBOUNCE_MS);

        let url = `https://api.github.com/search/repositories?q=${term}`;

        // We yield an AJAX request and wait for it to complete. If the task
        // is restarted before this request completes, the XHR request
        // is aborted (open the inspector and see for yourself :)
        let json = yield this.get('getUsers').perform(url);
        callback(json.items.slice(0, 10));
    }).restartable(),

    getUsers: task(function * (url) {
        let xhr;
        try {
            xhr = $.getJSON(url);
            let result = yield xhr.promise();
            return result;
        } finally {
            xhr.abort();
        }
    }),

    setupAtMention () {
        var self = this;

        this.$().atwho({
            at: '@',
            limit: 50,
            maxLen:200,
            data: [],
            insertTpl: "<a href='${name}' type='profile' target='_blank'>${name}</a>",
            callbacks: {
                remoteFilter (query, callback) {
                    self.get('remoteFilter').perform(query, callback);
                }
            }
        }).atwho ({
            at: '#',
            maxLen:200,
            data: [],
            spaceSelectsMatch: true,
            insertTpl: "<a href='${name}' type='search' target='_blank'>#${name}</a>",
            callbacks: {
                beforeSave () {
                    self.set('atWhoCls', this);
                },

                afterMatchFailed () {
                    self.highlightTag();
                    return false;
                }
            }
        });
    },

    willDestroy () {
        this.get('atWhoCls').destroy();
    }
});
