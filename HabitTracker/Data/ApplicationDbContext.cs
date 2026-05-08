using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Habit> Habits => Set<Habit>();

    public DbSet<HabitRecord> HabitRecords => Set<HabitRecord>();

    public DbSet<HabitCategory> HabitCategories => Set<HabitCategory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(user => user.Email).IsUnique();
            entity.HasIndex(user => user.Username).IsUnique();
            entity.HasMany(user => user.Habits)
                .WithOne(habit => habit.User)
                .HasForeignKey(habit => habit.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.Navigation(user => user.Habits).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        modelBuilder.Entity<Habit>(entity =>
        {
            entity.HasOne(habit => habit.Category)
                .WithMany(category => category.Habits)
                .HasForeignKey(habit => habit.HabitCategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(habit => habit.Records)
                .WithOne(record => record.Habit)
                .HasForeignKey(record => record.HabitId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.Navigation(habit => habit.Records).UsePropertyAccessMode(PropertyAccessMode.Field);
        });

        modelBuilder.Entity<HabitRecord>(entity =>
        {
            entity.HasIndex(record => new { record.HabitId, record.Date }).IsUnique();
        });

        modelBuilder.Entity<HabitCategory>().HasData(
            new HabitCategory { Id = 1, Name = "Health", Color = "#2f9e44", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new HabitCategory { Id = 2, Name = "Study", Color = "#1c7ed6", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new HabitCategory { Id = 3, Name = "Productivity", Color = "#f08c00", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new HabitCategory { Id = 4, Name = "Mindfulness", Color = "#7048e8", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    private void UpdateTimestamps()
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = utcNow;
                entry.Entity.UpdatedAt = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = utcNow;
            }
        }
    }
}
