"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaCollection = void 0;
exports.MediaCollection = {
    slug: 'media',
    name: 'media',
    admin: {
        useAsTitle: 'filename',
        group: 'Content',
        icon: 'image',
    },
    fields: [
        {
            name: 'filename',
            type: 'text',
            required: true,
        },
        {
            name: 'originalName',
            type: 'text',
            required: true,
        },
        {
            name: 'mimeType',
            type: 'text',
            required: true,
        },
        {
            name: 'fileSize',
            type: 'number',
            required: true,
        },
        {
            name: 'width',
            type: 'number',
        },
        {
            name: 'height',
            type: 'number',
        },
        {
            name: 'alt',
            type: 'text',
        },
        {
            name: 'caption',
            type: 'text',
        },
        {
            name: 'folderId',
            type: 'number',
        },
        {
            name: 'path',
            type: 'text',
            required: true,
            admin: {
                hidden: true,
            }
        },
        {
            name: 'provider',
            type: 'text',
            required: true,
            defaultValue: 'local'
        },
        {
            name: 'integration',
            type: 'text',
            required: true,
            defaultValue: 'storage'
        }
    ],
};
exports.default = exports.MediaCollection;
//# sourceMappingURL=MediaCollection.js.map