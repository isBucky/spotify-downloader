import { selectFolder } from './prompts/select-folder';
import { confirm, input } from '@inquirer/prompts';
import { SpotifyClient } from './clients/spotify';
import { YoutubeClient } from './clients/youtube';

// Types
import type { TrackInfo } from '../types/client-spotify';

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

        switch (type) {
            case 'playlist':
                {
                    console.log(`Searching for playlist with ID ${id}...`);

                    const playlist = await this.spotify.playlist.get(id);
                    if (!playlist) return console.log('Playlist not found');

                    const tracks = await this.spotify.playlist.tracks(id, 0);
                    if (!tracks) return console.log('Playlist not found');

                    console.log(`Playlist found! Total of ${tracks.total} tracks\n`);

                    await this.downloadMassive(id, `${dir}/${playlist.name}`, 'playlist', tracks);
                }
                break;

            case 'album':
                {
                    console.log(`Searching for album with ID ${id}...`);

                    const album = await this.spotify.album.get(id);
                    if (!album) return console.log('Album not found');

                    const tracks = await this.spotify.album.tracks(id, 0);
                    if (!tracks) return console.log('Album not found');

                    console.log(`Album found! Total of ${tracks.total} tracks\n`);

                    await this.downloadMassive(id, `${dir}/${album.name}`, 'album', tracks);
                }
                break;

            case 'track': {
                console.log(`Searching for track with ID ${id}...`);

                const track = await this.spotify.track.get(id);
                if (!track) return console.log('Track not found');

                console.log(`Track found: '${track.name}' by '${track.artists[0].name}'\n`);

                return await this.searchInYoutubeAndDownload(track, dir);
            }

            case 'unknown':
                console.log('Invalid URL');
                break;
        }
    }

    /**
     * Download all tracks from an album or playlist.
     *
     * @param id The ID of the album or playlist.
     * @param dir The directory where the tracks will be saved.
     * @param type The type of the ID (album or playlist).
     * @param result The result of the search, with information about the tracks.
     *
     * @returns A promise that resolves when all tracks are downloaded.
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
     * Search for a track on YouTube and download it as an MP3 in a directory.
     *
     * @param track The track to search for.
     * @param dir The directory where the track will be saved.
     */
    public async searchInYoutubeAndDownload(track: TrackInfo, dir: string) {
        try {
            const result = await this.youtube.search(`${track.name} - ${track.artists[0].name}`);
            const video = result.videos[0];

            if (!video) {
                console.log(`No music found for '${track.name}' by '${track.artists[0].name}'`);
                return;
            }

            await this.youtube.downloadMp3(video.url, dir);

            console.log(`Music downloaded: '${track.name}' by '${track.artists[0].name}'`);
        } catch (error) {
            console.log(`Error downloading music: '${track.name}' by '${track.artists[0].name}'`, {
                cause: error,
            });
        }
    }

    public async startPrompts() {
        const dir = await selectFolder({ message: 'Enter the download directory:' });
        const url = await input({
            message: 'Enter the music URL:',
            required: true,
        });

        console.log('');
        await this.download(url, dir);
        console.log('');

        const otherDownload = await confirm({
            message: 'Do you want to download another music?',
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
