import { selectFolder } from './prompts/select-folder';
import { confirm, input } from '@inquirer/prompts';
import { SpotifyClient } from './clients/spotify';
import { YoutubeClient } from './clients/youtube';

import chalk from 'chalk';

// Types
import type { TrackInfo } from '../types/client-spotify';
import { inspect } from 'util';
import yts from 'yt-search';

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
            const result = await this.youtube.search(
                `${track.name} - ${track.artists[0].name} lyric`,
            );
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
            console.log(error);
            console.log(
                chalk.red('x'),
                chalk.bold(`Error downloading song: '${track.name}' by '${track.artists[0].name}'`),
            );
        }
    }

    public sortVideos(videos: yts.VideoSearchResult[]) {
        return videos.sort((a, b) => {
            // Se ambos não tiverem data, ordene por visualizações e depois por duração
            if (a.ago === undefined && b.ago === undefined) {
                // Se as visualizações forem semelhantes, priorize duração menor
                const viewsDiff = b.views - a.views;
                if (Math.abs(viewsDiff) < b.views * 0.2) {
                    // Diferença menor que 20%
                    return a.seconds - b.seconds; // Vídeos mais curtos primeiro
                }
                return viewsDiff;
            }

            // Se apenas um não tiver data, coloque-o por último
            if (a.ago === undefined) return 1;
            if (b.ago === undefined) return -1;

            // Verifique se existe uma grande diferença em visualizações
            const viewsRatio = b.views / a.views;

            // Extrair informação de tempo a partir da string "ago"
            const getTimeValue = (agoString) => {
                const match = agoString.match(/(\d+)\s+(\w+)\s+ago/);
                if (!match) return 0;

                const value = parseInt(match[1]);
                const unit = match[2].toLowerCase();

                // Converter tudo para dias para facilitar a comparação
                switch (unit) {
                    case 'year':
                    case 'years':
                        return value * 365;
                    case 'month':
                    case 'months':
                        return value * 30;
                    case 'week':
                    case 'weeks':
                        return value * 7;
                    case 'day':
                    case 'days':
                        return value;
                    case 'hour':
                    case 'hours':
                        return value / 24;
                    case 'minute':
                    case 'minutes':
                        return value / (24 * 60);
                    default:
                        return value;
                }
            };

            const aDays = getTimeValue(a.ago);
            const bDays = getTimeValue(b.ago);

            // Se há grande diferença em visualizações (mais de 30%), priorize visualizações
            if (viewsRatio > 1.3 || viewsRatio < 0.7) {
                return b.views - a.views;
            }

            // Se os vídeos são da mesma época (diferença de menos de 30 dias)
            const daysDiff = Math.abs(aDays - bDays);
            if (daysDiff < 30) {
                // Priorize o com menor duração
                return a.seconds - b.seconds;
            }

            // Caso contrário, priorize o mais recente
            return aDays - bDays;
        });
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
