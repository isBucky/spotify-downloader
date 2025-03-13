import type { SpotifyClient } from '.';
import type { ArtistInfo, SpotifyResponse } from '../../../types/client-spotify';

export class SpotifyArtist {
    constructor(private client: SpotifyClient) {}

    public get rest() {
        return this.client.rest;
    }

    public async get(artistId: string) {
        if (!this.client.started) throw new Error('The Spotify client has not been started');

        try {
            const request = await this.rest.artists(artistId).get();

            const artist = <SpotifyResponse<ArtistInfo>>await request.json();
            if (artist.error) return this.client.parseError(artist.error);

            return artist;
        } catch (error) {
            throw new Error('Error getting artist', { cause: error });
        }
    }
}
