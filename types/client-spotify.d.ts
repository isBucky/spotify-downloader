export type SpotifyResponse<T> = SpotifyErrorRequest & T;

export interface ArtistInfo {
    external_urls: {
        spotify: string;
    };
    followers: {
        href: null | string;
        total: number;
    };
    genres: string[];
    href: string;
    id: string;
    images: {
        url: string;
        height: number;
        width: number;
    }[];
    name: string;
    popularity: number;
    type: string;
    uri: string;
}

export interface TrackInfo {
    id: string;
    name: string;
    href: string;
    type: string;
    artists: {
        id: string;
        name: string;
        href: string;
    }[];
}

export interface PlaylistInfo {
    id: string;
    name: string;
    type: string;
    public: boolean;
    tracks: {
        total: number;
        items: {
            track: TrackInfo;
        }[];
    };
}

export interface AlbumInfo {
    id: string;
    name: string;
    type: string;
    total_tracks: number;
    tracks: {
        items: TrackInfo[];
    };
}

export interface RequestTokenData {
    access_token: string;
    token_type: string;
    expires_in: number;
}

type SpotifyUrlType = 'playlist' | 'track' | 'album' | 'artist' | 'unknown';

interface SpotifyUrlInfo {
    type: SpotifyUrlType;
    id: string;
    originalUrl: string;
}

export interface SpotifyErrorRequest {
    error?: {
        status: number;
        message: string;
    };
}
