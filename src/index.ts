import { selectFolder } from './prompts/select-folder';
import { confirm, input } from '@inquirer/prompts';
import { SpotifyClient } from './clients/spotify';
import { YoutubeClient } from './clients/youtube';

import chalk from 'chalk';

// Types
import type { TrackInfo } from '../types/client-spotify';
import { inspect } from 'util';

export class SpotifyDownloader {
    public spotify: SpotifyClient;
    public youtube: YoutubeClient;

    constructor() {
        this.spotify = new SpotifyClient();
        this.youtube = new YoutubeClient();
    }

    /**
     * Downloads a Spotify track, album, or playlist based on the provided URL.
     *
     * @param url The Spotify URL of the track, album, or playlist to download.
     * @param dir The directory where the downloaded content will be saved.
     *
     * The function parses the URL to determine its type (track, album, or playlist)
     * and then proceeds to download the content accordingly:
     * - For playlists, it fetches the playlist information and its tracks, then downloads all tracks.
     * - For albums, it fetches the album details and its tracks, then downloads all tracks.
     * - For individual tracks, it searches for the track on YouTube and downloads it as an MP3.
     * If the URL type is unknown, it logs an invalid URL message.
     */
    public async download(url: string, dir: string) {
        const { id, type } = this.spotify.parseSpotifyUrl(url);

        try {
            switch (type) {
                case 'playlist':
                    {
                        console.log(chalk.bold(`🔎 Searching for playlist with ID ${id}...`));

                        const playlist = await this.spotify.playlist.get(id);
                        if (!playlist)
                            return console.log(chalk.red('x'), chalk.bold('Playlist not found'));

                        const tracks = await this.spotify.playlist.tracks(id, 0);
                        if (!tracks)
                            return console.log(chalk.red('x'), chalk.bold('Playlist not found'));

                        console.log(
                            chalk.green('✔'),
                            chalk.bold(`Playlist found! Total of ${tracks.total} songs\n`),
                        );

                        await this.downloadMassive(
                            id,
                            `${dir}/${playlist.name}`,
                            'playlist',
                            tracks,
                        );
                    }
                    break;

                case 'album':
                    {
                        console.log(chalk.bold(`🔎 Searching for album with ID ${id}...`));

                        const album = await this.spotify.album.get(id);
                        if (!album)
                            return console.log(chalk.red('x'), chalk.bold('Album not found'));

                        const tracks = await this.spotify.album.tracks(id, 0);
                        if (!tracks)
                            return console.log(chalk.red('x'), chalk.bold('Album not found'));

                        console.log(
                            chalk.green('✔'),
                            chalk.bold(`Album found! Total of ${tracks.total} songs\n`),
                        );

                        await this.downloadMassive(id, `${dir}/${album.name}`, 'album', tracks);
                    }
                    break;

                case 'track': {
                    console.log(chalk.bold(`🔎 Searching for song with ID ${id}...`));

                    const track = await this.spotify.track.get(id);
                    if (!track) return console.log(chalk.red('x'), chalk.bold('Song not found'));

                    console.log(
                        chalk.green('✔'),
                        chalk.bold(`Song found: '${track.name}' by '${track.artists[0].name}'\n`),
                    );

                    return await this.searchInYoutubeAndDownload(track, dir);
                }

                case 'unknown':
                    console.log(chalk.red('x'), chalk.bold('Invalid URL'));
                    break;
            }
        } catch (error) {
            console.log(chalk.red('x'), chalk.bold('Error:'), inspect(error, { colors: true }));
        }
    }

    /**
     * Download all songs from an album or playlist.
     *
     * @param id The ID of the album or playlist.
     * @param dir The directory where the songs will be saved.
     * @param type The type of the ID (album or playlist).
     * @param result The result of the search, with information about the songs.
     *
     * @returns A promise that resolves when all songs have been downloaded.
     */
    public async downloadMassive(
        id: string,
        dir: string,
        type: 'album' | 'playlist',
        result: NonNullable<Awaited<ReturnType<SpotifyClient['playlist']['tracks']>>>,
    ) {
        const promiseFactories: (() => Promise<any>)[] = [];

        const addPromises = async (tracks: TrackInfo[]) => {
            for (const track of tracks) {
                promiseFactories.push(() => this.searchInYoutubeAndDownload(track, dir));
            }

            if (!result.next) return;

            return this.downloadMassive(
                id,
                dir,
                type,
                type === 'album'
                    ? (await this.spotify.album.tracks(id, result.next))!
                    : (await this.spotify.playlist.tracks(id, result.next))!,
            );
        };

        await addPromises(result.tracks);
        return await Promise.all(promiseFactories.map((f) => f()));
    }

    /**
     * Search for a song in YouTube and download it in MP3 format to a directory.
     *
     * @param track The song to be downloaded.
     * @param dir The directory where the song will be saved.
     */
    public async searchInYoutubeAndDownload(track: TrackInfo, dir: string) {
        try {
            const result = await this.youtube.search(`${track.name} - ${track.artists[0].name}`);
            const video = result.videos[0];

            if (!video) {
                console.log(
                    chalk.red('x'),
                    chalk.bold(`No song found for '${track.name}' by '${track.artists[0].name}'`),
                );
                return;
            }

            await this.youtube.downloadMp3(video.url, dir);

            console.log(
                chalk.green('✔'),
                chalk.bold('Song downloaded:'),
                chalk.green(`'${track.name}' by '${track.artists[0].name}'`),
            );
        } catch (error) {
            console.log(
                chalk.red('x'),
                chalk.bold(`Error downloading song: '${track.name}' by '${track.artists[0].name}'`),
            );
        }
    }

    public async startPrompts() {
        console.clear();

        const dir = await selectFolder({ message: 'Enter the download directory:' });
        const url = await input({
            message: 'Enter the song URL:',
            required: true,
        });

        console.log('');
        await this.download(url, dir);
        console.log('');

        const otherDownload = await confirm({
            message: 'Do you want to download another song?',
            default: true,
        });

        if (!otherDownload) return process.exit(1);

        console.log('');
        return this.startPrompts();
    }

    public async start() {
        await this.spotify.start();
        return this.startPrompts();
    }
}
