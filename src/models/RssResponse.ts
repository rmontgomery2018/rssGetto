export class Item {
    description: string;
    link: string;
    pubDate: string;
    title: string;
}
export class RssResponse {
    rss: {
        channel: {
            item: Item[]
        }
    }
}