// Dataset transformado (mantiene todas las películas).
// Cambios aplicados:
// 1) Se eliminaron de genres las categorías: Crime, Biography, Historical, Musical, Horror, Mystery, Superhero, Music, War
// 2) costUSD fue dividido por 1000 (ahora está en miles de USD)

window.MOVIES = [
  {
    id: "inception",
    title: "Inception",
    year: 2010,
    minutes: 148,
    genres: ["Sci-Fi", "Action", "Thriller"],
    imdbRating: 8.8,
    costUSD: 160_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg"
  },
  {
    id: "dark_knight",
    title: "The Dark Knight",
    year: 2008,
    minutes: 152,
    genres: ["Action", "Drama"], // Crime eliminado
    imdbRating: 9.0,
    costUSD: 185_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/1/1c/The_Dark_Knight_%282008_film%29.jpg/250px-The_Dark_Knight_%282008_film%29.jpg"
  },
  {
    id: "interstellar",
    title: "Interstellar",
    year: 2014,
    minutes: 169,
    genres: ["Sci-Fi", "Adventure", "Drama"],
    imdbRating: 8.7,
    costUSD: 165_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg"
  },
  {
    id: "arrival",
    title: "Arrival",
    year: 2016,
    minutes: 116,
    genres: ["Sci-Fi", "Drama"], // Mystery eliminado
    imdbRating: 7.9,
    costUSD: 47_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/d/df/Arrival%2C_Movie_Poster.jpg"
  },
  {
    id: "la_la_land",
    title: "La La Land",
    year: 2016,
    minutes: 128,
    genres: ["Romance", "Drama"], // Musical eliminado
    imdbRating: 8.0,
    costUSD: 30_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ab/La_La_Land_%28film%29.png/250px-La_La_Land_%28film%29.png"
  },
  {
    id: "toy_story",
    title: "Toy Story",
    year: 1995,
    minutes: 81,
    genres: ["Animation", "Adventure"],
    imdbRating: 8.3,
    costUSD: 30_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/1/13/Toy_Story.jpg"
  },
  {
    id: "spirited_away",
    title: "Spirited Away",
    year: 2001,
    minutes: 125,
    genres: ["Animation", "Fantasy", "Adventure"],
    imdbRating: 8.6,
    costUSD: 19_200,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/d/db/Spirited_Away_Japanese_poster.png/250px-Spirited_Away_Japanese_poster.png"
  },
  {
    id: "parasite",
    title: "Parasite",
    year: 2019,
    minutes: 132,
    genres: ["Thriller", "Drama", "Comedy"],
    imdbRating: 8.5,
    costUSD: 11_400,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Parasite_%282019_film%29.png/250px-Parasite_%282019_film%29.png"
  },
  {
    id: "mad_max_fury_road",
    title: "Mad Max: Fury Road",
    year: 2015,
    minutes: 120,
    genres: ["Action", "Adventure", "Sci-Fi"],
    imdbRating: 8.1,
    costUSD: 170_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6e/Mad_Max_Fury_Road.jpg/250px-Mad_Max_Fury_Road.jpg"
  },
  {
    id: "grand_budapest",
    title: "The Grand Budapest Hotel",
    year: 2014,
    minutes: 100,
    genres: ["Comedy", "Drama"],
    imdbRating: 8.1,
    costUSD: 25_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Grand_Budapest_Hotel.png"
  },
  {
    id: "titanic",
    title: "Titanic",
    year: 1997,
    minutes: 195,
    genres: ["Romance", "Drama"],
    imdbRating: 7.9,
    costUSD: 200_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYzYyN2FiZmUtYWYzMy00MzViLWJkZTMtOGY1ZjgzNWMwN2YxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "avatar",
    title: "Avatar",
    year: 2009,
    minutes: 162,
    genres: ["Sci-Fi", "Adventure", "Action"],
    imdbRating: 7.9,
    costUSD: 237_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/d/d6/Avatar_%282009_film%29_poster.jpg"
  },
  {
    id: "gladiator",
    title: "Gladiator",
    year: 2000,
    minutes: 155,
    genres: ["Action", "Drama"], // Historical eliminado
    imdbRating: 8.5,
    costUSD: 103_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYWQ4YmNjYjEtOWE1Zi00Y2U4LWI4NTAtMTU0MjkxNWQ1ZmJiXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "jurassic_park",
    title: "Jurassic Park",
    year: 1993,
    minutes: 127,
    genres: ["Adventure", "Sci-Fi"],
    imdbRating: 8.2,
    costUSD: 63_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/e/e7/Jurassic_Park_poster.jpg"
  },
  {
    id: "the_lord_of_the_rings_fellowship",
    title: "The Lord of the Rings: The Fellowship of the Ring",
    year: 2001,
    minutes: 178,
    genres: ["Fantasy", "Adventure", "Drama"],
    imdbRating: 8.8,
    costUSD: 93_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNzIxMDQ2YTctNDY4MC00ZTRhLTk4ODQtMTVlOWY4NTdiYmMwXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "harry_potter_sorcerer",
    title: "Harry Potter and the Sorcerer's Stone",
    year: 2001,
    minutes: 152,
    genres: ["Fantasy", "Adventure"],
    imdbRating: 7.6,
    costUSD: 125_000,
    posterUrl: "https://www.originalfilmart.com/cdn/shop/files/harry_potter_and_the_sorcerers_stone_2001_original_film_art_5000x.webp?v=1684872812"
  },
  {
    id: "the_matrix",
    title: "The Matrix",
    year: 1999,
    minutes: 136,
    genres: ["Sci-Fi", "Action"],
    imdbRating: 8.7,
    costUSD: 63_000,
    posterUrl: "https://www.originalfilmart.com/cdn/shop/products/the_matrix_1999_bus_stop_original_film_art_5000x.jpg?v=1593131403"
  },
  {
    id: "the_godfather",
    title: "The Godfather",
    year: 1972,
    minutes: 175,
    genres: ["Drama"], // Crime eliminado
    imdbRating: 9.2,
    costUSD: 6_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_ver1.jpg"
  },
  {
    id: "frozen",
    title: "Frozen",
    year: 2013,
    minutes: 102,
    genres: ["Animation", "Fantasy"],
    imdbRating: 7.4,
    costUSD: 150_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/0/05/Frozen_%282013_film%29_poster.jpg"
  },
  {
    id: "black_panther",
    title: "Black Panther",
    year: 2018,
    minutes: 134,
    genres: ["Action", "Adventure", "Sci-Fi"],
    imdbRating: 7.3,
    costUSD: 200_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTg1MTY2MjYzNV5BMl5BanBnXkFtZTgwMTc4NTMwNDI@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "oppenheimer",
    title: "Oppenheimer",
    year: 2023,
    minutes: 180,
    genres: ["Drama"], // Biography, Historical eliminados
    imdbRating: 8.4,
    costUSD: 100_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/4/4a/Oppenheimer_%28film%29.jpg"
  },
  {
    id: "barbie",
    title: "Barbie",
    year: 2023,
    minutes: 114,
    genres: ["Comedy", "Fantasy"],
    imdbRating: 6.9,
    costUSD: 145_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/0/0b/Barbie_2023_poster.jpg"
  },
  {
    id: "joker",
    title: "Joker",
    year: 2019,
    minutes: 122,
    genres: ["Drama", "Thriller"], // Crime eliminado
    imdbRating: 8.4,
    costUSD: 55_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/e/e1/Joker_%282019_film%29_poster.jpg"
  },
  {
    id: "top_gun_maverick",
    title: "Top Gun: Maverick",
    year: 2022,
    minutes: 130,
    genres: ["Action", "Drama"],
    imdbRating: 8.2,
    costUSD: 170_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/1/13/Top_Gun_Maverick_Poster.jpg"
  },
  {
    id: "incredibles",
    title: "The Incredibles",
    year: 2004,
    minutes: 115,
    genres: ["Animation", "Action"],
    imdbRating: 8.0,
    costUSD: 92_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTY5OTU0OTc2NV5BMl5BanBnXkFtZTcwMzU4MDcyMQ@@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "shrek",
    title: "Shrek",
    year: 2001,
    minutes: 90,
    genres: ["Animation", "Comedy", "Adventure"],
    imdbRating: 7.9,
    costUSD: 60_000,
    posterUrl: "https://visualprint-store.com/cdn/shop/files/shrek_ver3_xxlg.jpg?v=1682451794"
  },
  {
    id: "whiplash",
    title: "Whiplash",
    year: 2014,
    minutes: 106,
    genres: ["Drama"], // Music eliminado
    imdbRating: 8.5,
    costUSD: 3_300,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/0/01/Whiplash_poster.jpg"
  },
  {
    id: "the_prestige",
    title: "The Prestige",
    year: 2006,
    minutes: 130,
    genres: ["Drama", "Sci-Fi"], // Mystery eliminado
    imdbRating: 8.5,
    costUSD: 40_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/d/d2/Prestige_poster.jpg"
  },
  {
    id: "finding_nemo",
    title: "Finding Nemo",
    year: 2003,
    minutes: 100,
    genres: ["Animation", "Adventure"],
    imdbRating: 8.2,
    costUSD: 94_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/2/29/Finding_Nemo.jpg"
  },
  {
    id: "deadpool",
    title: "Deadpool",
    year: 2016,
    minutes: 108,
    genres: ["Action", "Comedy"], // Superhero eliminado
    imdbRating: 8.0,
    costUSD: 58_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNzY3ZWU5NGQtOTViNC00ZWVmLTliNjAtNzViNzlkZWQ4YzQ4XkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "dune_2021",
    title: "Dune",
    year: 2021,
    minutes: 155,
    genres: ["Sci-Fi", "Adventure", "Drama"],
    imdbRating: 8.0,
    costUSD: 165_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/8/8e/Dune_%282021_film%29.jpg"
  },
  {
    id: "the_dark_knight_rises",
    title: "The Dark Knight Rises",
    year: 2012,
    minutes: 164,
    genres: ["Action", "Drama"],
    imdbRating: 8.4,
    costUSD: 250_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/8/83/Dark_knight_rises_poster.jpg"
  },
  {
    id: "avengers_endgame",
    title: "Avengers: Endgame",
    year: 2019,
    minutes: 181,
    genres: ["Action", "Adventure", "Sci-Fi"],
    imdbRating: 8.4,
    costUSD: 356_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/0/0d/Avengers_Endgame_poster.jpg"
  },
  {
    id: "coco",
    title: "Coco",
    year: 2017,
    minutes: 105,
    genres: ["Animation", "Fantasy"],
    imdbRating: 8.4,
    costUSD: 175_000,
    posterUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSM17YJATdJiHD-Xp-ac6y8RwaI-O6RyiGzaA&s"
  },
  {
    id: "the_social_network",
    title: "The Social Network",
    year: 2010,
    minutes: 120,
    genres: ["Drama"], // Biography eliminado
    imdbRating: 7.8,
    costUSD: 40_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMjlkNTE5ZTUtNGEwNy00MGVhLThmZjMtZjU1NDE5Zjk1NDZkXkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "skyfall",
    title: "Skyfall",
    year: 2012,
    minutes: 143,
    genres: ["Action", "Adventure"],
    imdbRating: 7.8,
    costUSD: 200_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/a7/Skyfall_poster.jpg"
  },
  {
    id: "gravity",
    title: "Gravity",
    year: 2013,
    minutes: 91,
    genres: ["Sci-Fi", "Thriller"],
    imdbRating: 7.7,
    costUSD: 100_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/f/f6/Gravity_Poster.jpg"
  },
  {
    id: "logan",
    title: "Logan",
    year: 2017,
    minutes: 137,
    genres: ["Action", "Drama"], // Superhero eliminado
    imdbRating: 8.1,
    costUSD: 100_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/3/37/Logan_2017_poster.jpg"
  },
  {
    id: "inside_out",
    title: "Inside Out",
    year: 2015,
    minutes: 95,
    genres: ["Animation", "Drama"],
    imdbRating: 8.1,
    costUSD: 175_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BOTgxMDQwMDk0OF5BMl5BanBnXkFtZTgwNjU5OTg2NDE@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "no_time_to_die",
    title: "No Time to Die",
    year: 2021,
    minutes: 163,
    genres: ["Action", "Thriller"],
    imdbRating: 7.3,
    costUSD: 250_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BZGZiOGZhZDQtZmRkNy00ZmUzLTliMGEtZGU0NjExOGMxZDVkXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "pulp_fiction",
    title: "Pulp Fiction",
    year: 1994,
    minutes: 154,
    genres: ["Drama"], // Crime eliminado
    imdbRating: 8.9,
    costUSD: 8_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYTViYTE3ZGQtNDBlMC00ZTAyLTkyODMtZGRiZDg0MjA2YThkXkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "fight_club",
    title: "Fight Club",
    year: 1999,
    minutes: 139,
    genres: ["Drama", "Thriller"],
    imdbRating: 8.8,
    costUSD: 63_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/f/fc/Fight_Club_poster.jpg"
  },
  {
    id: "forrest_gump",
    title: "Forrest Gump",
    year: 1994,
    minutes: 142,
    genres: ["Drama", "Romance"],
    imdbRating: 8.8,
    costUSD: 55_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/6/67/Forrest_Gump_poster.jpg"
  },
  {
    id: "the_lion_king",
    title: "The Lion King",
    year: 1994,
    minutes: 88,
    genres: ["Animation", "Adventure"],
    imdbRating: 8.5,
    costUSD: 45_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/3/3d/The_Lion_King_poster.jpg"
  },
  {
    id: "star_wars_a_new_hope",
    title: "Star Wars: A New Hope",
    year: 1977,
    minutes: 121,
    genres: ["Sci-Fi", "Adventure"],
    imdbRating: 8.6,
    costUSD: 11_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/8/87/StarWarsMoviePoster1977.jpg"
  },
  {
    id: "the_shawshank_redemption",
    title: "The Shawshank Redemption",
    year: 1994,
    minutes: 142,
    genres: ["Drama"],
    imdbRating: 9.3,
    costUSD: 25_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/8/81/ShawshankRedemptionMoviePoster.jpg"
  },
  {
    id: "braveheart",
    title: "Braveheart",
    year: 1995,
    minutes: 178,
    genres: ["Drama"], // Historical eliminado
    imdbRating: 8.3,
    costUSD: 72_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNGMxZDBhNGQtYTZlNi00N2UzLWI4NDEtNmUzNWM2NTdmZDA0XkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "the_silence_of_the_lambs",
    title: "The Silence of the Lambs",
    year: 1991,
    minutes: 118,
    genres: ["Thriller"], // Crime eliminado
    imdbRating: 8.6,
    costUSD: 19_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/8/86/The_Silence_of_the_Lambs_poster.jpg"
  },
  {
    id: "et",
    title: "E.T. the Extra-Terrestrial",
    year: 1982,
    minutes: 115,
    genres: ["Sci-Fi"],
    imdbRating: 7.9,
    costUSD: 10_500,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/6/66/E_t_the_extra_terrestrial_ver3.jpg"
  },
  {
    id: "terminator_2",
    title: "Terminator 2: Judgment Day",
    year: 1991,
    minutes: 137,
    genres: ["Action", "Sci-Fi"],
    imdbRating: 8.6,
    costUSD: 102_000,
    posterUrl: "https://i.ebayimg.com/images/g/nPUAAOSwvx1bt3yD/s-l1200.jpg"
  },
  {
    id: "goodfellas",
    title: "Goodfellas",
    year: 1990,
    minutes: 146,
    genres: ["Drama"], // Crime eliminado
    imdbRating: 8.7,
    costUSD: 25_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/7/7b/Goodfellas.jpg"
  },
  {
    id: "the_departed",
    title: "The Departed",
    year: 2006,
    minutes: 151,
    genres: ["Thriller"], // Crime eliminado
    imdbRating: 8.5,
    costUSD: 90_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/5/50/Departed234.jpg"
  },
  {
    id: "the_avengers_2012",
    title: "The Avengers",
    year: 2012,
    minutes: 143,
    genres: ["Action", "Adventure", "Sci-Fi"],
    imdbRating: 8.0,
    costUSD: 220_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNGE0YTVjNzUtNzJjOS00NGNlLTgxMzctZTY4YTE1Y2Y1ZTU4XkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "iron_man",
    title: "Iron Man",
    year: 2008,
    minutes: 126,
    genres: ["Action", "Sci-Fi"],
    imdbRating: 7.9,
    costUSD: 140_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTczNTI2ODUwOF5BMl5BanBnXkFtZTcwMTU0NTIzMw@@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "moana",
    title: "Moana",
    year: 2016,
    minutes: 107,
    genres: ["Animation", "Adventure"],
    imdbRating: 7.6,
    costUSD: 150_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/2/26/Moana_Teaser_Poster.jpg"
  },
  {
    id: "her",
    title: "Her",
    year: 2013,
    minutes: 126,
    genres: ["Drama", "Romance", "Sci-Fi"],
    imdbRating: 8.0,
    costUSD: 23_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/4/44/Her2013Poster.jpg"
  },
  {
    id: "the_hangover",
    title: "The Hangover",
    year: 2009,
    minutes: 100,
    genres: ["Comedy"],
    imdbRating: 7.7,
    costUSD: 35_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/b/b9/Hangoverposter09.jpg"
  },
  {
    id: "mission_impossible_fallout",
    title: "Mission: Impossible – Fallout",
    year: 2018,
    minutes: 147,
    genres: ["Action", "Adventure", "Thriller"],
    imdbRating: 7.7,
    costUSD: 178_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BZmUwZTg2YmMtMmZjOS00ZDYwLWI2ZDgtZDcyY2ZmMWMwZDdlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "blade_runner_2049",
    title: "Blade Runner 2049",
    year: 2017,
    minutes: 164,
    genres: ["Sci-Fi", "Drama"],
    imdbRating: 8.0,
    costUSD: 150_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNzA1Njg4NzYxOV5BMl5BanBnXkFtZTgwODk5NjU3MzI@._V1_.jpg"
  },
  {
    id: "get_out",
    title: "Get Out",
    year: 2017,
    minutes: 104,
    genres: ["Thriller"], // Horror eliminado
    imdbRating: 7.7,
    costUSD: 4_500,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/a3/Get_Out_poster.png"
  },
  {
    id: "the_green_mile",
    title: "The Green Mile",
    year: 1999,
    minutes: 189,
    genres: ["Drama", "Fantasy"],
    imdbRating: 8.6,
    costUSD: 60_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/e/e2/The_Green_Mile_%28movie_poster%29.jpg"
  },
  {
    id: "saving_private_ryan",
    title: "Saving Private Ryan",
    year: 1998,
    minutes: 169,
    genres: ["Drama"], // War eliminado
    imdbRating: 8.6,
    costUSD: 70_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/ac/Saving_Private_Ryan_poster.jpg"
  },
  {
    id: "american_beauty",
    title: "American Beauty",
    year: 1999,
    minutes: 122,
    genres: ["Drama"],
    imdbRating: 8.3,
    costUSD: 15_000,
    posterUrl: "https://www.originalfilmart.com/cdn/shop/products/american_beauty_1999_original_film_art_a_7c79b7ad-678e-48f1-ba68-efc314945690_600x.jpg?v=1562541235"
  },
  {
    id: "cast_away",
    title: "Cast Away",
    year: 2000,
    minutes: 143,
    genres: ["Adventure", "Drama"],
    imdbRating: 7.8,
    costUSD: 90_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BOGNjNDI5ZGQtZjRjMy00NzQyLWFiYzQtYjcwNjM3ZDYwNThhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "the_truman_show",
    title: "The Truman Show",
    year: 1998,
    minutes: 103,
    genres: ["Drama", "Sci-Fi"],
    imdbRating: 8.2,
    costUSD: 60_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNzA3ZjZlNzYtMTdjMy00NjMzLTk5ZGYtMTkyYzNiOGM1YmM3XkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "casino_royale",
    title: "Casino Royale",
    year: 2006,
    minutes: 144,
    genres: ["Action", "Adventure"],
    imdbRating: 8.0,
    costUSD: 150_000,
    posterUrl: "https://www.originalfilmart.com/cdn/shop/products/casino_royale_2006_advance_original_film_art_5000x.jpg?v=1592955843"
  },
  {
    id: "how_to_train_your_dragon",
    title: "How to Train Your Dragon",
    year: 2010,
    minutes: 98,
    genres: ["Animation", "Adventure"],
    imdbRating: 8.1,
    costUSD: 165_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/9/99/How_to_Train_Your_Dragon_Poster.jpg"
  },
  {
    id: "a_beautiful_mind",
    title: "A Beautiful Mind",
    year: 2001,
    minutes: 135,
    genres: ["Drama"], // Biography eliminado
    imdbRating: 8.2,
    costUSD: 58_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/b/b8/A_Beautiful_Mind_Poster.jpg"
  },
  {
    id: "madagascar",
    title: "Madagascar",
    year: 2005,
    minutes: 86,
    genres: ["Animation", "Comedy"],
    imdbRating: 6.9,
    costUSD: 75_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYjk4OGFmZmYtYWE4NC00MzM4LTkwZTItODdhMjk3NTZjMmI5XkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "the_wolf_of_wall_street",
    title: "The Wolf of Wall Street",
    year: 2013,
    minutes: 180,
    genres: ["Drama"], // Biography, Crime eliminados
    imdbRating: 8.2,
    costUSD: 100_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMjIxMjgxNTk0MF5BMl5BanBnXkFtZTgwNjIyOTg2MDE@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "the_revenant",
    title: "The Revenant",
    year: 2015,
    minutes: 156,
    genres: ["Adventure", "Drama"],
    imdbRating: 8.0,
    costUSD: 135_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/b/b6/The_Revenant_2015_film_poster.jpg"
  },
  {
    id: "interview_with_vampire",
    title: "Interview with the Vampire",
    year: 1994,
    minutes: 123,
    genres: ["Drama", "Fantasy"],
    imdbRating: 7.5,
    costUSD: 60_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYzJlN2NiZDQtZmI4NC00ZWFiLWFmMTUtMWM4ODVlOGFlODY1XkEyXkFqcGc@._V1_.jpg"
  },
  {
    id: "the_greatest_showman",
    title: "The Greatest Showman",
    year: 2017,
    minutes: 105,
    genres: ["Drama"], // Musical eliminado
    imdbRating: 7.5,
    costUSD: 84_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/1/10/The_Greatest_Showman_poster.png"
  },
  {
    id: "aladdin_2019",
    title: "Aladdin",
    year: 2019,
    minutes: 128,
    genres: ["Fantasy", "Adventure"],
    imdbRating: 6.9,
    costUSD: 183_000,
    posterUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRe8PWTumPvlbWl5wIvMANwLZT8paZpkpfk5g&s"
  },
  {
    id: "kung_fu_panda",
    title: "Kung Fu Panda",
    year: 2008,
    minutes: 92,
    genres: ["Animation", "Action", "Comedy"],
    imdbRating: 7.6,
    costUSD: 130_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/7/76/Kungfupanda.jpg"
  },
  {
    id: "the_bourne_identity",
    title: "The Bourne Identity",
    year: 2002,
    minutes: 119,
    genres: ["Action", "Thriller"],
    imdbRating: 7.9,
    costUSD: 60_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/ae/BourneIdentityfilm.jpg"
  },
  {
    id: "ice_age",
    title: "Ice Age",
    year: 2002,
    minutes: 81,
    genres: ["Animation", "Adventure"],
    imdbRating: 7.5,
    costUSD: 59_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/3/3c/Ice_Age_%282002_film%29_poster.jpg"
  },
  {
    id: "300_movie",
    title: "300",
    year: 2006,
    minutes: 117,
    genres: ["Action"], // Historical eliminado
    imdbRating: 7.6,
    costUSD: 65_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/5/5c/300poster.jpg"
  },
  {
    id: "the_conjuring",
    title: "The Conjuring",
    year: 2013,
    minutes: 112,
    genres: ["Thriller"], // Horror eliminado
    imdbRating: 7.5,
    costUSD: 20_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTM3NjA1NDMyMV5BMl5BanBnXkFtZTcwMDQzNDMzOQ@@._V1_.jpg"
  },
  {
    id: "jaws",
    title: "Jaws",
    year: 1975,
    minutes: 124,
    genres: ["Thriller", "Adventure"],
    imdbRating: 8.1,
    costUSD: 9_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BYjViNDQzNmUtYzkxZi00NTk5LTljMmItYjJlZmZkODIxNjU1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "notting_hill",
    title: "Notting Hill",
    year: 1999,
    minutes: 124,
    genres: ["Romance", "Comedy"],
    imdbRating: 7.2,
    costUSD: 42_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BZjY3YWI5OTMtYTdlNy00ZTZiLWEwYjItN2M1MGVkMDM4ZDExXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "crazy_rich_asians",
    title: "Crazy Rich Asians",
    year: 2018,
    minutes: 120,
    genres: ["Romance", "Comedy"],
    imdbRating: 6.9,
    costUSD: 30_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTYxNDMyOTAxN15BMl5BanBnXkFtZTgwMDg1ODYzNTM@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "love_actually",
    title: "Love Actually",
    year: 2003,
    minutes: 135,
    genres: ["Romance", "Comedy"],
    imdbRating: 7.6,
    costUSD: 45_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/e/eb/Love_Actually_movie.jpg"
  },
  {
    id: "the_princess_bride",
    title: "The Princess Bride",
    year: 1987,
    minutes: 98,
    genres: ["Fantasy", "Romance", "Adventure"],
    imdbRating: 8.0,
    costUSD: 16_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/d/db/Princess_bride.jpg"
  },
  {
    id: "beauty_and_the_beast_2017",
    title: "Beauty and the Beast",
    year: 2017,
    minutes: 129,
    genres: ["Fantasy", "Romance"],
    imdbRating: 7.1,
    costUSD: 160_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/d/d6/Beauty_and_the_Beast_2017_poster.jpg"
  },
  {
    id: "midnight_in_paris",
    title: "Midnight in Paris",
    year: 2011,
    minutes: 94,
    genres: ["Fantasy", "Romance", "Comedy"],
    imdbRating: 7.7,
    costUSD: 17_000,
    posterUrl: "https://upload.wikimedia.org/wikipedia/en/9/9f/Midnight_in_Paris_Poster.jpg"
  },
  {
    id: "about_time",
    title: "About Time",
    year: 2013,
    minutes: 123,
    genres: ["Romance", "Fantasy", "Drama"],
    imdbRating: 7.8,
    costUSD: 12_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTA1ODUzMDA3NzFeQTJeQWpwZ15BbWU3MDgxMTYxNTk@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "the_mask",
    title: "The Mask",
    year: 1994,
    minutes: 101,
    genres: ["Comedy", "Fantasy"],
    imdbRating: 6.9,
    costUSD: 23_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BNGNmNjI0ZmMtMzI5MC00ZjUyLWFlZDEtYjUyMGZlN2E3N2E2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "mamma_mia",
    title: "Mamma Mia!",
    year: 2008,
    minutes: 108,
    genres: ["Romance", "Comedy"], // Musical eliminado
    imdbRating: 6.5,
    costUSD: 52_000,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BMTA2MDU0MjM0MzReQTJeQWpwZ15BbWU3MDYwNzgwNzE@._V1_FMjpg_UX1000_.jpg"
  },
  {
    id: "the_shape_of_water",
    title: "The Shape of Water",
    year: 2017,
    minutes: 123,
    genres: ["Fantasy", "Romance", "Drama"],
    imdbRating: 7.3,
    costUSD: 19_500,
    posterUrl: "https://m.media-amazon.com/images/M/MV5BOGFlMTM2MTgtZDdlMy00ZDZlLWFjOTUtZDMzMGEwNmNiMWY0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
  }
];
