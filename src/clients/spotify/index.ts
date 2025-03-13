import { spotify } from '../../config';

import RestManager from 'rest-manager';

// Types
import type {
    RequestTokenData,
    SpotifyErrorRequest,
    SpotifyUrlInfo,
    SpotifyUrlType,
    TrackInfo,
} from '../../../types/client-spotify';

import { SpotifyPlaylist } from './playlist';
import { SpotifyArtist } from './artist';
import { SpotifyAlbum } from './album';
import { SpotifyTrack } from './track';

export class SpotifyClient {
    public started: boolean;
    public baseUrl: string;
    public refreshTokenUrl: string;
    public authorization: string;

    public playlist: SpotifyPlaylist;
    public album: SpotifyAlbum;
    public track: SpotifyTrack;
    public artist: SpotifyArtist;

    constructor() {
        this.started = false;

        this.baseUrl = 'https://api.spotify.com/v1';

        this.refreshTokenUrl =
            'https://accounts.spotify.com/api/token?grant_type=client_credentials';

        this.authorization = Buffer.from(`${spotify.clientId}:${spotify.clientSecret}`).toString(
            'base64',
        );

        this.playlist = new SpotifyPlaylist(this);
        this.album = new SpotifyAlbum(this);
        this.track = new SpotifyTrack(this);
        this.artist = new SpotifyArtist(this);
    }

    public async start() {
        await this.refreshToken();

        this.started = true;
        return this;
    }

    public parseError(error: NonNullable<SpotifyErrorRequest['error']>): undefined {
        if (error.status === 404 && error.message.includes('Resource not found')) {
            throw new Error('Resource not found');
        }

        if (error.status === 400 && error.message.includes('Invalid base62 id')) {
            throw new Error('Invalid ID');
        }

        throw new Error('Error getting information, error: ' + error.message);
    }

    public parseTracks(tracks: TrackInfo[]) {
        return tracks.filter((t) => t.type === 'track');
    }

    public parseSpotifyUrl(url: string): SpotifyUrlInfo {
        const spotifyWebUrlRegex =
            /https?:\/\/(?:open\.)?spotify\.com\/(?:intl-[a-z]+\/)?([a-z]+)\/([a-zA-Z0-9]{22})(?:\?.*)?$/;

        const spotifyUriRegex = /^spotify:([a-z]+):([a-zA-Z0-9]{22})$/;

        let match = url.match(spotifyWebUrlRegex);
        if (!match) {
            match = url.match(spotifyUriRegex);
        }

        if (!match) {
            return {
                type: 'unknown',
                id: '',
                originalUrl: url,
            };
        }

        const typeCandidate = match[1];
        const id = match[2];

        const validTypes: SpotifyUrlType[] = ['playlist', 'track', 'album', 'artist'];

        return {
            id,

            type: validTypes.includes(typeCandidate as SpotifyUrlType)
                ? (typeCandidate as SpotifyUrlType)
                : 'unknown',

            originalUrl: url,
        };
    }

    public get rest() {
        return new RestManager(this.baseUrl, {
            headers: {
                Authorization: `Bearer ${global['spotifyToken'] as string}`,
                'Content-Type': 'application/json',
            },
        }).router;
    }

    private async refreshToken() {
        try {
            const request = await fetch(this.refreshTokenUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${this.authorization}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const data = <RequestTokenData>await request.json();

            global['spotifyToken'] = data.access_token;
            setTimeout(() => this.refreshToken(), data.expires_in * 1e3 - 5e3);
        } catch (error) {
            throw new Error('Could not get access token, error: ' + error);
        }
    }
}
