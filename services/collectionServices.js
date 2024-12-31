const createCollection = (db, collection_id, username, collection_name, is_public) => {
    let success = true
    const sql = `
        INSERT INTO user_collection (collection_id, username, collection_name, is_public)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [collection_id, username, collection_name, is_public], (err, result) => {
        if (err) {
            console.error('Error creating collection:', err);
            return false
        };
    });
    return success
}

module.exports = {createCollection}