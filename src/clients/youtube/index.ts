import { spawn } from 'node:child_process';
import ytSearch from 'yt-search';

export class YoutubeClient {
    /**
     * Searches for YouTube videos based on the provided query.
     *
     * @param query - The search term to use for finding videos.
     */
    public search(query: string) {
        return ytSearch({
            query,
            gl: 'BR',
            hl: 'pt-BR',
            pages: 1,
        });
    }

    /**
     * Downloads a video from youtube as an mp3 file.
     *
     * @param url The URL of the video to be downloaded.
     * @param path The path where the video will be saved.
     */
    public downloadMp3(url: string, path: string): Promise<true> {
        return new Promise((resolve, reject) => {
            const command = spawn('yt-dlp', [
                '--extract-audio',

                '--audio-format',
                'mp3',

                '--audio-quality',
                '0',

                '--embed-thumbnail',
                '--add-metadata',
                `-P ${path}`,

                url,
            ]).on('close', (code) => {
                if (code === 0) {
                    resolve(true);
                }
            });

            command.stderr.on('data', (data) => {
                return reject(data.toString());
            });
        });
    }
}
