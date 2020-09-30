# Bangumi Data [![Awesome](https://badgen.net/badge/icon/awesome/fc60a8?icon=awesome&label)](https://github.com/bangumi-data/awesome)

动画番组及其放送、资讯站点数据集合

## Changes

增加了从萌娘百科获取的剧场版/OVA数据

增加了releaseDate/bdReleaseDate，代表剧场版和OVA的上映时间/BD发售时间

为保持向后兼容性，剧场版和OVA仍然有begin和end，默认begin等于bdReleaseDate，end等于bdReleaseDate加一个月

在生成时会自动生成animeType，标识这个番组是TV、OVA或剧场版

## License

The data in this repo is available for use under a CC BY 4.0 license (http://creativecommons.org/licenses/by/4.0/). For attribution just mention somewhere that the source is bangumi-data. If you have any questions about using the data for your project please contact us.
