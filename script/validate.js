const path = require('path');
const fs = require('fs-extra');
const { readJsonPaths } = require('./utils');
const Joi = require('joi');
const siteSchema = require('./schema/site');
const itemSchema = require('./schema/item');

const ITEMS_DIRECTORY = 'data/items/';
const SITES_DIRECTORY = 'data/sites/';

const validateItems = readJsonPaths(ITEMS_DIRECTORY)
    .then((itemPaths) => {
        // 同步读取所有json文件
        itemPaths.forEach((itemPath) => {
            const dataArray = fs.readJsonSync(itemPath);

            dataArray.forEach((itemData) => {
                Joi.validate(itemData, itemSchema, (error) => {
                    if (error) {
                        throw error;
                    }
                });
            });
        });
    });

const validateSites = readJsonPaths(SITES_DIRECTORY)
    .then((sitePaths) => {
        // 同步读取所有json文件
        sitePaths.forEach((sitePath) => {
            const siteData = fs.readJsonSync(sitePath);

            Object.keys(siteData).forEach((key) => {
                Joi.validate(siteData[key], siteSchema, (error) => {
                    if (error) {
                        throw error;
                    }
                });
            });
        });
    });

// 验证 Bangumi ID 是唯一的
const validateUniqueBangumiId = readJsonPaths(ITEMS_DIRECTORY)
    .then((itemPaths) => {
        const idMap = Object.create(null);
        itemPaths.forEach((itemPath) => {
            const dataArray = fs.readJsonSync(itemPath);
            dataArray.forEach((itemData) => {
                const id = (itemData.sites.find((site) => {
                    return site.site === 'bangumi';
                }) || {}).id;
                if (!id) {
                    return;
                }
                if (idMap[id]) {
                    const paths = [
                        path.relative(ITEMS_DIRECTORY, idMap[id]),
                        path.relative(ITEMS_DIRECTORY, itemPath)
                    ];
                    throw new Error(`Bangumi ID ${id} is duplicated in ${paths.join(' and ')}`);
                }
                idMap[id] = itemPath;
            });
        });
    });

Promise.all([validateItems, validateSites, validateUniqueBangumiId])
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
